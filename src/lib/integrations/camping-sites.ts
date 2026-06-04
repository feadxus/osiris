import { sourceMeta } from './source-metadata.ts';

export const OVERPASS_CAMPING_URL = 'https://overpass-api.de/api/interpreter';

export type CampingBbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type OverpassCampingElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type CampingSite = {
  id: string;
  name: string;
  kind: 'camp_site' | 'caravan_site';
  lat: number;
  lng: number;
  operator?: string;
  website?: string;
  phone?: string;
  capacity?: string;
  tags: Record<string, string>;
  source: ReturnType<typeof sourceMeta>;
};

type CampingSeed = Omit<CampingSite, 'source' | 'tags'> & {
  tags?: Record<string, string>;
};

const FALLBACK_CAMPING_SITES: CampingSeed[] = [
  {
    id: 'fallback-camping-berlin-kladow',
    name: 'Campingplatz Berlin Kladow',
    kind: 'camp_site',
    lat: 52.4581,
    lng: 13.1433,
    website: 'https://www.campingplatz-kladow.de/',
  },
  {
    id: 'fallback-camping-muenchen-thalkirchen',
    name: 'Campingplatz Muenchen-Thalkirchen',
    kind: 'camp_site',
    lat: 48.0879,
    lng: 11.5459,
    website: 'https://www.campingplatz-thalkirchen.de/',
  },
  {
    id: 'fallback-camping-hamburg-stover-strand',
    name: 'Camping Stover Strand',
    kind: 'camp_site',
    lat: 53.4144,
    lng: 10.2805,
    website: 'https://www.stover-strand.de/',
  },
  {
    id: 'fallback-camping-nuremberg-knaus',
    name: 'KNAUS Campingpark Nuernberg',
    kind: 'camp_site',
    lat: 49.4264,
    lng: 11.1289,
    website: 'https://www.knauscamp.de/nuernberg',
  },
  {
    id: 'fallback-caravan-duesseldorf-rheinblick',
    name: 'Reisemobilstellplatz Rheinblick',
    kind: 'caravan_site',
    lat: 51.2165,
    lng: 6.7277,
  },
  {
    id: 'fallback-camping-wien-neue-donau',
    name: 'Camping Neue Donau',
    kind: 'camp_site',
    lat: 48.2089,
    lng: 16.4487,
    website: 'https://www.campingwien.at/',
  },
  {
    id: 'fallback-camping-salzburg-nord-sam',
    name: 'Camping Nord-Sam Salzburg',
    kind: 'camp_site',
    lat: 47.8297,
    lng: 13.0583,
    website: 'https://www.camping-nord-sam.com/',
  },
  {
    id: 'fallback-camping-zurich-fischers-fritz',
    name: 'Fischers Fritz Camping',
    kind: 'camp_site',
    lat: 47.3435,
    lng: 8.5359,
    website: 'https://www.fischers-fritz.ch/',
  },
  {
    id: 'fallback-camping-prague-dzban',
    name: 'Camp Dzban Praha',
    kind: 'camp_site',
    lat: 50.0946,
    lng: 14.3247,
    website: 'https://www.campdzban.eu/',
  },
  {
    id: 'fallback-camping-sofia-vrana',
    name: 'Camping Vrana',
    kind: 'camp_site',
    lat: 42.6396,
    lng: 23.4209,
  },
  {
    id: 'fallback-camping-veliko-tarnovo',
    name: 'Camping Veliko Tarnovo',
    kind: 'camp_site',
    lat: 43.0476,
    lng: 25.7311,
    website: 'https://campingvelikotarnovo.com/',
  },
  {
    id: 'fallback-camping-istanbul-mocamp',
    name: 'Istanbul Mocamp',
    kind: 'camp_site',
    lat: 41.0172,
    lng: 28.5944,
  },
];

export function buildOverpassCampingQuery(bbox: CampingBbox): string {
  assertCampingBbox(bbox);
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:10];(
node["tourism"="camp_site"](${box});
way["tourism"="camp_site"](${box});
relation["tourism"="camp_site"](${box});
node["tourism"="caravan_site"](${box});
way["tourism"="caravan_site"](${box});
relation["tourism"="caravan_site"](${box});
);out center 300;`;
}

export function normalizeCampingElement(element: OverpassCampingElement): CampingSite | null {
  const lat = typeof element.lat === 'number' ? element.lat : element.center?.lat;
  const lng = typeof element.lon === 'number' ? element.lon : element.center?.lon;
  if (!element.type || typeof element.id !== 'number' || typeof lat !== 'number' || typeof lng !== 'number') return null;

  const tags = element.tags || {};
  const tourism = tags.tourism === 'caravan_site' ? 'caravan_site' : 'camp_site';

  return {
    id: `osm-${element.type}-${element.id}`,
    name: tags.name || tags.operator || (tourism === 'caravan_site' ? 'Unnamed caravan site' : 'Unnamed camp site'),
    kind: tourism,
    lat,
    lng,
    operator: tags.operator,
    website: tags.website || tags['contact:website'],
    phone: tags.phone || tags['contact:phone'],
    capacity: tags.capacity || tags['capacity:caravans'] || tags['capacity:tents'],
    tags,
    source: sourceMeta({
      provider: 'OpenStreetMap/Overpass',
      feed: 'camping-sites',
      url: OVERPASS_CAMPING_URL,
      attribution: 'OpenStreetMap contributors',
      license: 'ODbL',
      cacheTtlSeconds: 86400,
      confidence: 0.72,
    }),
  };
}

export async function fetchCampingSites(bbox: CampingBbox): Promise<CampingSite[]> {
  const query = buildOverpassCampingQuery(bbox);
  const res = await fetch(OVERPASS_CAMPING_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'OSIRIS/0.1 camping sites',
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

  const data = (await res.json()) as { elements?: OverpassCampingElement[] };
  return (data.elements || []).map(normalizeCampingElement).filter((item): item is CampingSite => Boolean(item));
}

export function fallbackCampingSites(bbox: CampingBbox): CampingSite[] {
  assertCampingBbox(bbox);
  return FALLBACK_CAMPING_SITES
    .filter(site => site.lat >= bbox.south && site.lat <= bbox.north && site.lng >= bbox.west && site.lng <= bbox.east)
    .map(site => ({
      ...site,
      tags: site.tags || {},
      source: sourceMeta({
        provider: 'OSIRIS fallback dataset',
        feed: 'camping-sites-fallback',
        attribution: 'Curated public camping location seed',
        cacheTtlSeconds: 86400,
        confidence: 0.45,
      }),
    }));
}

function assertCampingBbox(bbox: CampingBbox) {
  const width = bbox.east - bbox.west;
  const height = bbox.north - bbox.south;
  if (![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) {
    throw new Error('Invalid bbox coordinates');
  }
  if (width <= 0 || height <= 0 || width > 3 || height > 3) {
    throw new Error('Camping bbox must be positive and no larger than 3 degrees per axis');
  }
}
