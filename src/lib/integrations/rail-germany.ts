import { sourceMeta } from './source-metadata.ts';

export const OVERPASS_INTERPRETER_URL = 'https://overpass-api.de/api/interpreter';
export const DB_TRANSPORT_REST_URL = 'https://v6.db.transport.rest';

export type GermanyRailKind = 'station' | 'halt' | 'yard' | 'depot' | 'junction' | 'line';
export type RailOperationStatus = 'on_time' | 'delayed' | 'severe' | 'cancelled' | 'unknown';

export type StaticRailHub = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  operator?: string;
  network?: string;
};

export type StaticRailCorridor = {
  id: string;
  name: string;
  from: string;
  to: string;
  usage?: string;
  electrified?: string;
  gauge?: string;
  operator?: string;
  network?: string;
};

export type GermanyRailInfrastructure = {
  id: string;
  kind: GermanyRailKind;
  name: string;
  lat?: number;
  lng?: number;
  operator?: string;
  network?: string;
  uicRef?: string;
  ref?: string;
  electrified?: string;
  usage?: string;
  gauge?: string;
  geometry?: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  tags: Record<string, string>;
  source: ReturnType<typeof sourceMeta>;
};

export type RailDepartureOperation = {
  id: string;
  line: string;
  product?: string;
  direction?: string;
  when?: string;
  plannedWhen?: string;
  delayMinutes: number;
  status: RailOperationStatus;
  platform?: string;
  plannedPlatform?: string;
  platformChanged: boolean;
};

export type RailStationOperationStatus = {
  stationId: string;
  stationName: string;
  lat: number;
  lng: number;
  status: RailOperationStatus;
  departures: RailDepartureOperation[];
  delayedDepartures: number;
  severeDepartures: number;
  cancelledDepartures: number;
  platformChanges: number;
  source: ReturnType<typeof sourceMeta>;
};

type DbDeparture = {
  tripId?: string;
  id?: string;
  line?: {
    name?: string;
    productName?: string;
    product?: string;
  };
  direction?: string;
  when?: string | null;
  plannedWhen?: string | null;
  delay?: number | null;
  platform?: string | null;
  plannedPlatform?: string | null;
  cancelled?: boolean;
};

type RailOperationInput = {
  plannedWhen?: string | null;
  when?: string | null;
  delayMinutes?: number;
  cancelled?: boolean;
};

type OverpassGeometryPoint = {
  lat?: number;
  lon?: number;
};

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  geometry?: OverpassGeometryPoint[];
  tags?: Record<string, string>;
};

export const GERMANY_RAIL_HUBS: StaticRailHub[] = [
  { id: '8011160', name: 'Berlin Hbf', lat: 52.525592, lng: 13.369545, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000105', name: 'Frankfurt(Main)Hbf', lat: 50.107149, lng: 8.663785, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000261', name: 'München Hbf', lat: 48.140232, lng: 11.558335, operator: 'DB InfraGO', network: 'DB' },
  { id: '8002549', name: 'Hamburg Hbf', lat: 53.552733, lng: 10.006909, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000207', name: 'Köln Hbf', lat: 50.943029, lng: 6.958729, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000080', name: 'Düsseldorf Hbf', lat: 51.219961, lng: 6.794138, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000096', name: 'Dortmund Hbf', lat: 51.517899, lng: 7.459294, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000098', name: 'Dresden Hbf', lat: 51.040562, lng: 13.732035, operator: 'DB InfraGO', network: 'DB' },
  { id: '8010205', name: 'Leipzig Hbf', lat: 51.345477, lng: 12.382128, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000290', name: 'Nürnberg Hbf', lat: 49.445435, lng: 11.082276, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000091', name: 'Hannover Hbf', lat: 52.377689, lng: 9.741859, operator: 'DB InfraGO', network: 'DB' },
  { id: '8000090', name: 'Stuttgart Hbf', lat: 48.78395, lng: 9.181635, operator: 'DB InfraGO', network: 'DB' },
];

export const GERMANY_RAIL_CORRIDORS: StaticRailCorridor[] = [
  { id: 'berlin-hamburg', name: 'Berlin-Hamburg corridor', from: '8011160', to: '8002549', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'berlin-leipzig', name: 'Berlin-Leipzig corridor', from: '8011160', to: '8010205', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'leipzig-munich', name: 'Leipzig-Munich corridor', from: '8010205', to: '8000261', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'cologne-frankfurt', name: 'Cologne-Frankfurt corridor', from: '8000207', to: '8000105', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'frankfurt-stuttgart', name: 'Frankfurt-Stuttgart corridor', from: '8000105', to: '8000090', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'stuttgart-munich', name: 'Stuttgart-Munich corridor', from: '8000090', to: '8000261', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'dortmund-dusseldorf-cologne', name: 'Ruhr-Rhine corridor', from: '8000096', to: '8000207', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'hannover-berlin', name: 'Hannover-Berlin corridor', from: '8000091', to: '8011160', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'hannover-hamburg', name: 'Hannover-Hamburg corridor', from: '8000091', to: '8002549', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
  { id: 'dresden-leipzig', name: 'Dresden-Leipzig corridor', from: '8000098', to: '8010205', usage: 'main', electrified: 'contact_line', gauge: '1435', operator: 'DB InfraGO', network: 'DB' },
];

export function buildGermanyRailInfrastructureQuery(limit = 160): string {
  const boundedLimit = Math.min(500, Math.max(1, Math.round(limit)));
  return `[out:json][timeout:18];area["ISO3166-1"="DE"][admin_level=2]->.de;(
node["railway"~"station|halt|yard|depot|junction"](area.de);
way["railway"~"station|halt|yard|depot"](area.de);
way["railway"="rail"](area.de);
);out center geom ${boundedLimit};`;
}

export function normalizeStaticRailHub(hub: StaticRailHub): GermanyRailInfrastructure {
  return {
    id: `rail-de-hub-${hub.id}`,
    kind: 'station',
    name: hub.name,
    lat: hub.lat,
    lng: hub.lng,
    operator: hub.operator,
    network: hub.network,
    uicRef: hub.id,
    tags: {
      railway: 'station',
      uic_ref: hub.id,
      operator: hub.operator || '',
      network: hub.network || '',
    },
    source: railSourceMeta('rail-germany-infrastructure', 86400, 0.65),
  };
}

export function normalizeStaticRailCorridor(
  corridor: StaticRailCorridor,
  hubs: StaticRailHub[] = GERMANY_RAIL_HUBS,
): GermanyRailInfrastructure | null {
  const byId = new Map(hubs.map(hub => [hub.id, hub]));
  const from = byId.get(corridor.from);
  const to = byId.get(corridor.to);
  if (!from || !to) return null;

  return {
    id: `rail-de-corridor-${corridor.id}`,
    kind: 'line',
    name: corridor.name,
    operator: corridor.operator,
    network: corridor.network,
    electrified: corridor.electrified,
    usage: corridor.usage,
    gauge: corridor.gauge,
    geometry: {
      type: 'LineString',
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    },
    tags: {
      railway: 'rail',
      usage: corridor.usage || '',
      electrified: corridor.electrified || '',
      gauge: corridor.gauge || '',
      operator: corridor.operator || '',
      network: corridor.network || '',
    },
    source: railSourceMeta('rail-germany-infrastructure', 86400, 0.55),
  };
}

export function normalizeOverpassRailElement(element: OverpassElement): GermanyRailInfrastructure | null {
  if (!element.type || typeof element.id !== 'number') return null;
  const tags = element.tags || {};
  const kind = classifyRailKind(tags);
  if (!kind) return null;

  const geometry = kind === 'line' ? normalizeLineGeometry(element.geometry) : undefined;
  const lat = typeof element.lat === 'number' ? element.lat : element.center?.lat;
  const lng = typeof element.lon === 'number' ? element.lon : element.center?.lon;
  if (!geometry && (typeof lat !== 'number' || typeof lng !== 'number')) return null;

  return {
    id: buildRailId(element, tags),
    kind,
    name: tags.name || tags.ref || railKindLabel(kind),
    lat,
    lng,
    operator: tags.operator,
    network: tags.network,
    uicRef: tags.uic_ref,
    ref: tags.ref,
    electrified: tags.electrified,
    usage: tags.usage,
    gauge: tags.gauge,
    geometry,
    tags,
    source: railSourceMeta('rail-germany-infrastructure', 86400, 0.78),
  };
}

export async function fetchGermanyRailInfrastructure(limit = 160): Promise<GermanyRailInfrastructure[]> {
  const query = buildGermanyRailInfrastructureQuery(limit);
  const res = await fetch(OVERPASS_INTERPRETER_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'OSIRIS/0.1 germany rail infrastructure',
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(18000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

  const data = (await res.json()) as { elements?: OverpassElement[] };
  return dedupeRailInfrastructure(
    (data.elements || [])
      .map(normalizeOverpassRailElement)
      .filter((item): item is GermanyRailInfrastructure => Boolean(item)),
  );
}

export function staticGermanyRailInfrastructure(): GermanyRailInfrastructure[] {
  return [
    ...GERMANY_RAIL_HUBS.map(normalizeStaticRailHub),
    ...GERMANY_RAIL_CORRIDORS
      .map(corridor => normalizeStaticRailCorridor(corridor))
      .filter((item): item is GermanyRailInfrastructure => Boolean(item)),
  ];
}

export function classifyRailOperationStatus(input: RailOperationInput): RailOperationStatus {
  if (input.cancelled) return 'cancelled';
  const delayMinutes = typeof input.delayMinutes === 'number'
    ? input.delayMinutes
    : calculateDelayMinutes(input.plannedWhen, input.when);
  if (delayMinutes >= 15) return 'severe';
  if (delayMinutes >= 5) return 'delayed';
  if (input.plannedWhen || input.when) return 'on_time';
  return 'unknown';
}

export function normalizeDbDeparture(departure: DbDeparture): RailDepartureOperation | null {
  const line = departure.line?.name;
  const id = departure.tripId || departure.id;
  if (!id || !line) return null;
  const platform = departure.platform || undefined;
  const plannedPlatform = departure.plannedPlatform || undefined;
  const delayMinutes = typeof departure.delay === 'number'
    ? Math.max(0, Math.round(departure.delay / 60))
    : calculateDelayMinutes(departure.plannedWhen, departure.when);

  return {
    id,
    line,
    product: departure.line?.productName || departure.line?.product,
    direction: departure.direction,
    when: departure.when || undefined,
    plannedWhen: departure.plannedWhen || undefined,
    delayMinutes,
    status: classifyRailOperationStatus({
      plannedWhen: departure.plannedWhen,
      when: departure.when,
      cancelled: departure.cancelled,
      delayMinutes,
    }),
    platform,
    plannedPlatform,
    platformChanged: Boolean(platform && plannedPlatform && platform !== plannedPlatform),
  };
}

export function buildStationOperationStatus(
  station: StaticRailHub,
  departures: RailDepartureOperation[],
): RailStationOperationStatus {
  const delayedDepartures = departures.filter(departure => departure.status === 'delayed').length;
  const severeDepartures = departures.filter(departure => departure.status === 'severe').length;
  const cancelledDepartures = departures.filter(departure => departure.status === 'cancelled').length;
  const platformChanges = departures.filter(departure => departure.platformChanged).length;
  const status: RailOperationStatus = cancelledDepartures > 0 || severeDepartures > 0
    ? 'severe'
    : delayedDepartures > 0
      ? 'delayed'
      : departures.length > 0
        ? 'on_time'
        : 'unknown';

  return {
    stationId: station.id,
    stationName: station.name,
    lat: station.lat,
    lng: station.lng,
    status,
    departures,
    delayedDepartures,
    severeDepartures,
    cancelledDepartures,
    platformChanges,
    source: operationsSourceMeta(120, departures.length > 0 ? 0.72 : 0.45),
  };
}

export async function fetchStationDepartures(stationId: string, results = 8): Promise<RailDepartureOperation[]> {
  const params = new URLSearchParams({
    duration: '120',
    results: String(Math.min(20, Math.max(1, Math.round(results)))),
    remarks: 'true',
    stopovers: 'false',
    language: 'en',
  });
  const res = await fetch(`${DB_TRANSPORT_REST_URL}/stops/${encodeURIComponent(stationId)}/departures?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'OSIRIS/0.1 germany rail operations' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`db.transport.rest HTTP ${res.status}`);

  const data = (await res.json()) as DbDeparture[] | { departures?: DbDeparture[] };
  const departures = Array.isArray(data) ? data : data.departures || [];
  return departures
    .map(normalizeDbDeparture)
    .filter((item): item is RailDepartureOperation => Boolean(item));
}

export async function fetchGermanyRailOperations(
  hubs: StaticRailHub[] = GERMANY_RAIL_HUBS,
  departuresPerHub = 8,
): Promise<{ statuses: RailStationOperationStatus[]; errors: string[] }> {
  const settled = await Promise.allSettled(
    hubs.map(async hub => buildStationOperationStatus(hub, await fetchStationDepartures(hub.id, departuresPerHub))),
  );
  return {
    statuses: settled
      .filter((result): result is PromiseFulfilledResult<RailStationOperationStatus> => result.status === 'fulfilled')
      .map(result => result.value),
    errors: settled
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason instanceof Error ? result.reason.message : String(result.reason)),
  };
}

function classifyRailKind(tags: Record<string, string>): GermanyRailKind | null {
  const railway = tags.railway;
  if (railway === 'rail') return 'line';
  if (railway === 'station') return 'station';
  if (railway === 'halt') return 'halt';
  if (railway === 'yard') return 'yard';
  if (railway === 'depot') return 'depot';
  if (railway === 'junction') return 'junction';
  return null;
}

function normalizeLineGeometry(points?: OverpassGeometryPoint[]): GermanyRailInfrastructure['geometry'] | undefined {
  const coordinates = (points || [])
    .map((point): [number, number] | null => (
      typeof point.lon === 'number' && typeof point.lat === 'number' ? [point.lon, point.lat] : null
    ))
    .filter((point): point is [number, number] => Boolean(point));

  if (coordinates.length < 2) return undefined;
  return { type: 'LineString', coordinates };
}

function buildRailId(element: OverpassElement, tags: Record<string, string>): string {
  if (tags.uic_ref) return `rail-de-uic-${tags.uic_ref}`;
  return `rail-de-${element.type}-${element.id}`;
}

function railKindLabel(kind: GermanyRailKind): string {
  if (kind === 'line') return 'Rail line';
  if (kind === 'yard') return 'Rail yard';
  if (kind === 'depot') return 'Rail depot';
  if (kind === 'junction') return 'Rail junction';
  if (kind === 'halt') return 'Rail halt';
  return 'Rail station';
}

function railSourceMeta(feed: string, cacheTtlSeconds: number, confidence: number) {
  return sourceMeta({
    provider: 'OpenStreetMap/Overpass',
    feed,
    url: OVERPASS_INTERPRETER_URL,
    attribution: 'OpenStreetMap contributors',
    license: 'ODbL',
    cacheTtlSeconds,
    confidence,
  });
}

function operationsSourceMeta(cacheTtlSeconds: number, confidence: number) {
  return sourceMeta({
    provider: 'db.transport.rest',
    feed: 'rail-germany-operations',
    url: DB_TRANSPORT_REST_URL,
    attribution: 'db.transport.rest public API',
    license: 'upstream terms',
    cacheTtlSeconds,
    confidence,
  });
}

function calculateDelayMinutes(plannedWhen?: string | null, actualWhen?: string | null): number {
  if (!plannedWhen || !actualWhen) return 0;
  const planned = Date.parse(plannedWhen);
  const actual = Date.parse(actualWhen);
  if (!Number.isFinite(planned) || !Number.isFinite(actual)) return 0;
  return Math.max(0, Math.round((actual - planned) / 60000));
}

function dedupeRailInfrastructure(items: GermanyRailInfrastructure[]): GermanyRailInfrastructure[] {
  const seen = new Set<string>();
  const deduped: GermanyRailInfrastructure[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}
