import { assessWater, WaterParams } from './water-quality';

export interface WaterStation {
  id: string;
  source: 'USGS';
  name: string;
  lat: number;
  lng: number;
  status: string; // 'Good' | 'Moderate' | 'Poor' | 'Unknown'
  color: string;
  reason: string;
  params: Record<string, number | string | undefined>;
  lastUpdated: string | null;
  url: string;
}

// USGS parameter code → our WaterParams key
const USGS_PARAM_MAP: Record<string, keyof WaterParams> = {
  '00010': 'temp',
  '00300': 'do',
  '00400': 'ph',
  '00095': 'conductance',
  '63680': 'turbidity',
  '99133': 'nitrate',
};

interface Acc { name: string; lat: number; lng: number; params: WaterParams; updated: string | null; }

export function parseUsgsIv(json: any): WaterStation[] {
  const series = json?.value?.timeSeries ?? [];
  if (!Array.isArray(series)) return [];

  const bySite = new Map<string, Acc>();

  for (const ts of series) {
    const code = ts?.variable?.variableCode?.[0]?.value as string | undefined;
    const key = code ? USGS_PARAM_MAP[code] : undefined;
    if (!key) continue;

    const si = ts?.sourceInfo;
    const siteId = si?.siteCode?.[0]?.value;
    const lat = si?.geoLocation?.geogLocation?.latitude;
    const lng = si?.geoLocation?.geogLocation?.longitude;
    if (!siteId || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const valuesArr = ts?.values?.[0]?.value ?? [];
    const last = valuesArr[valuesArr.length - 1];
    const num = last ? parseFloat(last.value) : NaN;
    if (!Number.isFinite(num) || num <= -999999) continue; // USGS no-data sentinel

    let rec = bySite.get(siteId);
    if (!rec) {
      rec = { name: si?.siteName ?? siteId, lat, lng, params: {}, updated: null };
      bySite.set(siteId, rec);
    }
    rec.params[key] = num;
    const dt: string | null = last?.dateTime ?? null;
    if (dt && (!rec.updated || new Date(dt).getTime() > new Date(rec.updated).getTime())) rec.updated = dt;
  }

  const stations: WaterStation[] = [];
  for (const [siteId, rec] of bySite) {
    const a = assessWater(rec.params);
    stations.push({
      id: `usgs-${siteId}`,
      source: 'USGS',
      name: rec.name,
      lat: rec.lat,
      lng: rec.lng,
      status: a.status,
      color: a.color,
      reason: a.reason,
      params: { ...rec.params },
      lastUpdated: rec.updated,
      url: `https://waterdata.usgs.gov/monitoring-location/${siteId}/`,
    });
  }
  return stations;
}
