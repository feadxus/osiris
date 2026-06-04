import { sourceMeta, type OsirisSeverity } from './source-metadata.ts';

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

type OpenMeteoForecastInput = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    wind_speed_10m?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
  };
};

export type ForecastRiskLevel = OsirisSeverity;

export type OpenMeteoForecastSummary = {
  lat: number;
  lng: number;
  current: {
    time?: string;
    temperatureC?: number;
    windSpeedKmh?: number;
    precipitationMm?: number;
    rainMm?: number;
    weatherCode?: number;
  };
  risk: {
    level: ForecastRiskLevel;
    maxPrecipitationProbability: number;
    maxWindSpeedKmh: number;
    maxWindGustKmh: number;
    reasons: string[];
  };
  source: ReturnType<typeof sourceMeta>;
};

export function normalizeOpenMeteoForecast(input: OpenMeteoForecastInput): OpenMeteoForecastSummary {
  const lat = typeof input.latitude === 'number' ? input.latitude : 0;
  const lng = typeof input.longitude === 'number' ? input.longitude : 0;
  const maxPrecip = maxNumber(input.hourly?.precipitation_probability);
  const maxWind = maxNumber(input.hourly?.wind_speed_10m);
  const maxGust = maxNumber(input.hourly?.wind_gusts_10m);
  const risk = classifyForecastRisk({ maxPrecip, maxWind, maxGust });

  return {
    lat,
    lng,
    current: {
      time: input.current?.time,
      temperatureC: input.current?.temperature_2m,
      windSpeedKmh: input.current?.wind_speed_10m,
      precipitationMm: input.current?.precipitation,
      rainMm: input.current?.rain,
      weatherCode: input.current?.weather_code,
    },
    risk,
    source: sourceMeta({
      provider: 'Open-Meteo',
      feed: 'forecast',
      url: OPEN_METEO_FORECAST_URL,
      attribution: 'Open-Meteo.com',
      license: 'CC BY 4.0',
      observedAt: input.current?.time,
      cacheTtlSeconds: 1800,
      confidence: 0.85,
    }),
  };
}

export function classifyForecastRisk(input: {
  maxPrecip: number;
  maxWind: number;
  maxGust: number;
}): OpenMeteoForecastSummary['risk'] {
  const reasons: string[] = [];
  let level: ForecastRiskLevel = 'low';

  if (input.maxPrecip >= 80) {
    level = 'high';
    reasons.push('high_precipitation_probability');
  } else if (input.maxPrecip >= 50) {
    level = 'medium';
    reasons.push('elevated_precipitation_probability');
  }

  if (input.maxGust >= 75 || input.maxWind >= 50) {
    level = 'high';
    reasons.push('strong_wind');
  } else if ((input.maxGust >= 50 || input.maxWind >= 35) && level === 'low') {
    level = 'medium';
    reasons.push('elevated_wind');
  }

  return {
    level,
    maxPrecipitationProbability: input.maxPrecip,
    maxWindSpeedKmh: input.maxWind,
    maxWindGustKmh: input.maxGust,
    reasons,
  };
}

export async function fetchOpenMeteoForecast(lat: number, lng: number): Promise<OpenMeteoForecastSummary> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,wind_speed_10m,precipitation,rain,weather_code',
    hourly: 'precipitation_probability,wind_speed_10m,wind_gusts_10m',
    forecast_days: '2',
    timezone: 'auto',
  });
  const res = await fetch(`${OPEN_METEO_FORECAST_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  return normalizeOpenMeteoForecast(await res.json());
}

function maxNumber(values?: number[]): number {
  if (!values || values.length === 0) return 0;
  return values.reduce((max, value) => Number.isFinite(value) ? Math.max(max, value) : max, 0);
}
