import { sourceMeta } from './source-metadata.ts';

export const OVERPASS_INTERPRETER_URL = 'https://overpass-api.de/api/interpreter';

export type InfrastructureBbox = {
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
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type InfrastructureContextItem = {
  id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  operator?: string;
  tags: Record<string, string>;
  source: ReturnType<typeof sourceMeta>;
};

export function buildOverpassInfrastructureQuery(bbox: InfrastructureBbox): string {
  assertBbox(bbox);
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:10];(
node["power"="plant"](${box});
way["power"="plant"](${box});
node["amenity"="hospital"](${box});
way["amenity"="hospital"](${box});
node["man_made"="pipeline"](${box});
way["man_made"="pipeline"](${box});
node["railway"="station"](${box});
way["railway"="station"](${box});
node["aeroway"="aerodrome"](${box});
way["aeroway"="aerodrome"](${box});
node["harbour"](${box});
way["harbour"](${box});
);out center 50;`;
}

export function normalizeOverpassElement(element: OverpassElement): InfrastructureContextItem | null {
  const lat = typeof element.lat === 'number' ? element.lat : element.center?.lat;
  const lng = typeof element.lon === 'number' ? element.lon : element.center?.lon;
  if (!element.type || typeof element.id !== 'number' || typeof lat !== 'number' || typeof lng !== 'number') return null;
  const tags = element.tags || {};

  return {
    id: `osm-${element.type}-${element.id}`,
    type: classifyInfrastructure(tags),
    name: tags.name || tags.operator || 'Unnamed infrastructure',
    lat,
    lng,
    operator: tags.operator,
    tags,
    source: sourceMeta({
      provider: 'OpenStreetMap/Overpass',
      feed: 'infrastructure-context',
      url: OVERPASS_INTERPRETER_URL,
      attribution: 'OpenStreetMap contributors',
      license: 'ODbL',
      cacheTtlSeconds: 86400,
      confidence: 0.75,
    }),
  };
}

export async function fetchOverpassInfrastructure(bbox: InfrastructureBbox): Promise<InfrastructureContextItem[]> {
  const query = buildOverpassInfrastructureQuery(bbox);
  const res = await fetch(OVERPASS_INTERPRETER_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'OSIRIS/0.1 infrastructure context',
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

  const data = (await res.json()) as { elements?: OverpassElement[] };
  return (data.elements || []).map(normalizeOverpassElement).filter((item): item is InfrastructureContextItem => Boolean(item));
}

function classifyInfrastructure(tags: Record<string, string>): string {
  if (tags.power === 'plant') return 'power_plant';
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.man_made === 'pipeline') return 'pipeline';
  if (tags.railway === 'station') return 'rail_station';
  if (tags.aeroway === 'aerodrome') return 'airport';
  if (tags.harbour !== undefined) return 'harbour';
  return 'infrastructure';
}

function assertBbox(bbox: InfrastructureBbox) {
  const width = bbox.east - bbox.west;
  const height = bbox.north - bbox.south;
  if (![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) {
    throw new Error('Invalid bbox coordinates');
  }
  if (width <= 0 || height <= 0 || width > 2 || height > 2) {
    throw new Error('Overpass bbox must be positive and no larger than 2 degrees per axis');
  }
}
