import { NextResponse } from 'next/server';

const DEFLOCK_OVERPASS_ENDPOINT = 'https://overpass.deflock.org/api/interpreter';
const FALLBACK_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_SECONDS = 35;
const FETCH_TIMEOUT_MS = 45000;
const MAX_SPLIT_DEPTH = 3;
const MAX_RADIUS_KM = 250;
const MAX_DIRECT_SPAN_DEGREES = 5;

type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type DeflockCamera = {
  id: string;
  osm_id: number;
  lat: number;
  lng: number;
  name: string;
  city: string;
  country: string;
  source: string;
  external_url: string;
  surveillance_type?: string;
  camera_type?: string;
  brand?: string;
  operator?: string;
  deflock_tags: Record<string, string>;
};

class SplitAreaError extends Error {}
class RateLimitError extends Error {}
class OverpassError extends Error {}

function parseNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validateBBox(bounds: BBox): BBox {
  const normalized = {
    south: clamp(bounds.south, -85, 85),
    west: clamp(bounds.west, -180, 180),
    north: clamp(bounds.north, -85, 85),
    east: clamp(bounds.east, -180, 180),
  };

  if (normalized.south >= normalized.north || normalized.west >= normalized.east) {
    throw new Error('Invalid bbox. Expected south < north and west < east.');
  }

  return normalized;
}

function parseBBox(searchParams: URLSearchParams): BBox {
  const bbox = searchParams.get('bbox');
  if (bbox) {
    const parts = bbox.split(',').map(part => Number(part.trim()));
    if (parts.length !== 4 || parts.some(part => !Number.isFinite(part))) {
      throw new Error('Invalid bbox. Use bbox=south,west,north,east.');
    }
    return validateBBox({ south: parts[0], west: parts[1], north: parts[2], east: parts[3] });
  }

  const south = parseNumber(searchParams.get('south'));
  const west = parseNumber(searchParams.get('west'));
  const north = parseNumber(searchParams.get('north'));
  const east = parseNumber(searchParams.get('east'));

  if (south !== null && west !== null && north !== null && east !== null) {
    return validateBBox({ south, west, north, east });
  }

  const lat = parseNumber(searchParams.get('lat'));
  const lng = parseNumber(searchParams.get('lng'));
  const radiusKm = Math.min(parseNumber(searchParams.get('radiusKm')) ?? parseNumber(searchParams.get('radius')) ?? 25, MAX_RADIUS_KM);

  if (lat === null || lng === null) {
    throw new Error('Provide bbox=south,west,north,east or lat,lng,radiusKm.');
  }

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / Math.max(20, 111 * Math.cos(lat * Math.PI / 180));

  return validateBBox({
    south: lat - latDelta,
    west: lng - lngDelta,
    north: lat + latDelta,
    east: lng + lngDelta,
  });
}

function bboxToOverpass(bounds: BBox): string {
  return `${bounds.south.toFixed(6)},${bounds.west.toFixed(6)},${bounds.north.toFixed(6)},${bounds.east.toFixed(6)}`;
}

function buildDeflockQuery(bounds: BBox): string {
  const bbox = bboxToOverpass(bounds);
  return `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
(
  node["man_made"="surveillance"](${bbox});
  node["surveillance"](${bbox});
  node["surveillance:type"](${bbox});
  node["camera:type"](${bbox});
  node["brand"~"Flock Safety|Motorola|Vigilant|Genetec|Leonardo|ELSAG|Neology",i](${bbox});
  node["manufacturer"~"Flock Safety|Motorola|Vigilant|Genetec|Leonardo|ELSAG|Neology",i](${bbox});
  node["operator"~"Flock Safety|Motorola|Vigilant|Genetec|Leonardo|ELSAG|Neology",i](${bbox});
);
out body;`;
}

function shouldSplitBody(status: number, body: string): boolean {
  const lower = body.toLowerCase();
  return status === 400 && (
    lower.includes('too many nodes') ||
    lower.includes('runtime limit exceeded') ||
    lower.includes('query timed out') ||
    lower.includes('timeout')
  );
}

function readTag(tags: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = tags[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function cameraName(tags: Record<string, string>, osmId: number): string {
  const explicit = readTag(tags, 'name', 'ref');
  if (explicit) return explicit;

  const brand = readTag(tags, 'brand', 'manufacturer', 'operator');
  const surveillance = readTag(tags, 'surveillance:type', 'surveillance', 'camera:type');
  const label = surveillance ? surveillance.replace(/_/g, ' ') : 'surveillance node';
  return brand ? `${brand} ${label}` : `OSM ${label} ${osmId}`;
}

function normalizeNode(element: OverpassElement): DeflockCamera | null {
  if (element.type !== 'node') return null;
  if (typeof element.id !== 'number' || typeof element.lat !== 'number' || typeof element.lon !== 'number') return null;

  const tags = element.tags ?? {};
  return {
    id: `deflock-osm-${element.id}`,
    osm_id: element.id,
    lat: element.lat,
    lng: element.lon,
    name: cameraName(tags, element.id),
    city: readTag(tags, 'addr:city', 'addr:town', 'addr:village', 'is_in:city') ?? 'OSM',
    country: readTag(tags, 'addr:country', 'is_in:country_code', 'is_in:country') ?? 'OpenStreetMap',
    source: 'DeFlock Overpass / OpenStreetMap',
    external_url: `https://www.openstreetmap.org/node/${element.id}`,
    surveillance_type: readTag(tags, 'surveillance:type', 'surveillance'),
    camera_type: readTag(tags, 'camera:type'),
    brand: readTag(tags, 'brand', 'manufacturer'),
    operator: readTag(tags, 'operator'),
    deflock_tags: tags,
  };
}

function parseOverpassJson(data: OverpassResponse): DeflockCamera[] {
  const byId = new Map<number, DeflockCamera>();
  for (const element of data.elements ?? []) {
    const camera = normalizeNode(element);
    if (camera) byId.set(camera.osm_id, camera);
  }
  return Array.from(byId.values());
}

async function postOverpass(endpoint: string, query: string): Promise<DeflockCamera[]> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json',
        'User-Agent': 'OSIRIS/0.1 DeFlock-compatible Overpass client',
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SplitAreaError(`Overpass fetch timeout/network error: ${message}`);
  }

  const body = await response.text();
  if (!response.ok) {
    if (response.status === 429) throw new RateLimitError('Overpass rate limited this request.');
    if (shouldSplitBody(response.status, body)) throw new SplitAreaError(body.slice(0, 500));
    throw new OverpassError(`Overpass HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  try {
    return parseOverpassJson(JSON.parse(body) as OverpassResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OverpassError(`Invalid Overpass JSON: ${message}`);
  }
}

async function fetchWithFallback(query: string): Promise<DeflockCamera[]> {
  try {
    return await postOverpass(DEFLOCK_OVERPASS_ENDPOINT, query);
  } catch (primaryError) {
    if (primaryError instanceof SplitAreaError) throw primaryError;
    try {
      return await postOverpass(FALLBACK_OVERPASS_ENDPOINT, query);
    } catch (fallbackError) {
      if (fallbackError instanceof SplitAreaError) throw fallbackError;
      if (fallbackError instanceof RateLimitError) throw fallbackError;
      throw primaryError;
    }
  }
}

function splitBounds(bounds: BBox): BBox[] {
  const centerLat = (bounds.south + bounds.north) / 2;
  const centerLng = (bounds.west + bounds.east) / 2;
  return [
    { south: bounds.south, west: bounds.west, north: centerLat, east: centerLng },
    { south: bounds.south, west: centerLng, north: centerLat, east: bounds.east },
    { south: centerLat, west: bounds.west, north: bounds.north, east: centerLng },
    { south: centerLat, west: centerLng, north: bounds.north, east: bounds.east },
  ];
}

function shouldPreSplit(bounds: BBox): boolean {
  return (bounds.north - bounds.south) > MAX_DIRECT_SPAN_DEGREES ||
    (bounds.east - bounds.west) > MAX_DIRECT_SPAN_DEGREES;
}

async function fetchArea(bounds: BBox, depth = 0): Promise<DeflockCamera[]> {
  if (depth < MAX_SPLIT_DEPTH && shouldPreSplit(bounds)) {
    const chunks = await Promise.all(splitBounds(bounds).map(part => fetchArea(part, depth + 1)));
    return chunks.flat();
  }

  try {
    return await fetchWithFallback(buildDeflockQuery(bounds));
  } catch (error) {
    if (error instanceof SplitAreaError && depth < MAX_SPLIT_DEPTH) {
      const chunks = await Promise.all(splitBounds(bounds).map(part => fetchArea(part, depth + 1)));
      return chunks.flat();
    }
    throw error;
  }
}

function dedupe(cameras: DeflockCamera[]): DeflockCamera[] {
  const byId = new Map<number, DeflockCamera>();
  for (const camera of cameras) byId.set(camera.osm_id, camera);
  return Array.from(byId.values());
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const bounds = parseBBox(searchParams);
    const limit = Math.max(1, Math.min(parseNumber(searchParams.get('limit')) ?? 2500, 10000));

    const cameras = dedupe(await fetchArea(bounds)).slice(0, limit);
    const sources = cameras.reduce<Record<string, number>>((acc, camera) => {
      acc[camera.source] = (acc[camera.source] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      cameras,
      total: cameras.length,
      sources,
      regions: ['deflock'],
      bounds,
      source: {
        name: 'DeFlock compatible OSM surveillance pull',
        primary_endpoint: DEFLOCK_OVERPASS_ENDPOINT,
        fallback_endpoint: FALLBACK_OVERPASS_ENDPOINT,
      },
      elapsed_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith('Provide bbox') || message.startsWith('Invalid bbox') ? 400 : 502;

    return NextResponse.json({
      cameras: [],
      total: 0,
      error: message,
      usage: '/api/deflock?bbox=south,west,north,east or /api/deflock?lat=39.95&lng=-75.16&radiusKm=25',
      elapsed_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, {
      status,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
