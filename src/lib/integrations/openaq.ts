import {
  disabledSourceStatus,
  type IntegrationSourceStatus,
  type OsirisSeverity,
  sourceMeta,
} from './source-metadata.ts';

const OPENAQ_PM25_LATEST_URL = 'https://api.openaq.org/v3/parameters/2/latest';

type OpenAqCoordinates = {
  latitude?: number;
  longitude?: number;
};

type OpenAqParameter = {
  name?: string;
  units?: string;
  displayName?: string;
};

type OpenAqDateTime = {
  utc?: string;
  local?: string;
};

export type OpenAqLatestResult = {
  id?: number | string;
  locationsId?: number | string;
  location?: string;
  name?: string;
  locality?: string;
  city?: string;
  country?: string | { code?: string; name?: string };
  coordinates?: OpenAqCoordinates;
  parameter?: string | OpenAqParameter;
  value?: number;
  unit?: string;
  datetime?: OpenAqDateTime;
};

export type OpenAqStation = {
  id: string;
  name: string;
  city: string;
  country?: string;
  lat: number;
  lng: number;
  pm25: number;
  unit: string;
  level: string;
  color: string;
  severity: OsirisSeverity;
  lastUpdated?: string;
  source: ReturnType<typeof sourceMeta>;
};

export type OpenAqResponse = {
  enabled: boolean;
  stations: OpenAqStation[];
  total: number;
  timestamp: string;
  sources: {
    openaq: IntegrationSourceStatus;
  };
  setup?: {
    env: string;
    docs: string;
  };
  error?: string;
};

export function classifyPm25(value: number): { level: string; color: string; severity: OsirisSeverity } {
  if (value > 150) return { level: 'Hazardous', color: '#8B0000', severity: 'critical' };
  if (value > 100) return { level: 'Unhealthy', color: '#FF1744', severity: 'high' };
  if (value > 55) return { level: 'Unhealthy (Sensitive)', color: '#FF9500', severity: 'high' };
  if (value > 35) return { level: 'Moderate', color: '#FFD700', severity: 'medium' };
  return { level: 'Good', color: '#00E676', severity: 'low' };
}

export function normalizeOpenAqLatestResult(result: OpenAqLatestResult): OpenAqStation | null {
  const lat = result.coordinates?.latitude;
  const lng = result.coordinates?.longitude;
  const value = result.value;
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof value !== 'number') return null;

  const parameterName = typeof result.parameter === 'string' ? result.parameter : result.parameter?.name;
  if (parameterName && parameterName.toLowerCase() !== 'pm25') return null;

  const locationId = result.locationsId || result.id || `${lat.toFixed(4)}-${lng.toFixed(4)}`;
  const classification = classifyPm25(value);
  const observedAt = result.datetime?.utc || result.datetime?.local;
  const country = typeof result.country === 'string' ? result.country : result.country?.code || result.country?.name;

  return {
    id: `aq-${locationId}-pm25`,
    name: result.location || result.name || 'OpenAQ station',
    city: result.city || result.locality || 'Unknown',
    country,
    lat,
    lng,
    pm25: value,
    unit: result.unit || (typeof result.parameter === 'object' ? result.parameter.units : undefined) || 'µg/m3',
    level: classification.level,
    color: classification.color,
    severity: classification.severity,
    lastUpdated: observedAt,
    source: sourceMeta({
      provider: 'OpenAQ',
      feed: 'v3-parameters-2-latest',
      url: OPENAQ_PM25_LATEST_URL,
      attribution: 'OpenAQ',
      license: 'OpenAQ Terms of Use',
      observedAt,
      cacheTtlSeconds: 1800,
      confidence: 0.85,
    }),
  };
}

export function buildOpenAqDisabledResponse(): OpenAqResponse {
  return {
    enabled: false,
    stations: [],
    total: 0,
    timestamp: new Date().toISOString(),
    sources: {
      openaq: disabledSourceStatus(
        'OpenAQ',
        'OpenAQ v3 requires an API key in OPENAQ_API_KEY.',
        'https://docs.openaq.org/using-the-api/quick-start',
      ),
    },
    setup: {
      env: 'OPENAQ_API_KEY',
      docs: 'https://docs.openaq.org/using-the-api/quick-start',
    },
  };
}

export async function fetchOpenAqStations(apiKey: string): Promise<OpenAqStation[]> {
  const res = await fetch(`${OPENAQ_PM25_LATEST_URL}?limit=500`, {
    headers: {
      Accept: 'application/json',
      'X-API-Key': apiKey,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`OpenAQ HTTP ${res.status}`);
  }

  const data = (await res.json()) as { results?: OpenAqLatestResult[] };
  return (data.results || []).map(normalizeOpenAqLatestResult).filter((station): station is OpenAqStation => Boolean(station));
}
