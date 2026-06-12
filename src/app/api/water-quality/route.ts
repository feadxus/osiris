import { NextResponse } from 'next/server';
import { parseUsgsIv, WaterStation } from '@/lib/water-sources';

export const dynamic = 'force-dynamic';

const MAX_STATIONS = 6000;
const USGS_PARAMS = '00010,00300,00400,00095,63680,99133';
// Top-level 2-digit hydrologic regions covering the entire US (01–21).
const HUCS = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21'];
const TTL_MS = 10 * 60 * 1000;       // 10 min for non-empty results
const EMPTY_TTL_MS = 5 * 60 * 1000;  // short TTL for empty results — avoids poisoning the long TTL

let cache: { ts: number; stations: WaterStation[] } | null = null;

async function fetchAmbient(): Promise<WaterStation[]> {
  const results = await Promise.allSettled(
    HUCS.map(huc =>
      fetch(
        `https://waterservices.usgs.gov/nwis/iv/?format=json&huc=${huc}&parameterCd=${USGS_PARAMS}&siteStatus=active`,
        { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } }
      ).then(r => (r.ok ? r.json() : null))
    )
  );
  const seen = new Map<string, WaterStation>();
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    for (const st of parseUsgsIv(r.value)) {
      if (!seen.has(st.id)) seen.set(st.id, st);
    }
  }
  return Array.from(seen.values()).slice(0, MAX_STATIONS);
}

export async function GET() {
  try {
    const now = Date.now();
    const effectiveTTL = cache?.stations.length === 0 ? EMPTY_TTL_MS : TTL_MS;
    if (cache && now - cache.ts < effectiveTTL) {
      return NextResponse.json({
        source: 'ambient',
        total: cache.stations.length,
        timestamp: new Date(cache.ts).toISOString(),
        stations: cache.stations,
        cached: true,
      });
    }
    const stations = await fetchAmbient();
    cache = { ts: now, stations };
    return NextResponse.json({
      source: 'ambient',
      total: stations.length,
      timestamp: new Date(now).toISOString(),
      stations,
    });
  } catch (error) {
    console.error('Water Quality API error:', error);
    return NextResponse.json({ source: 'ambient', stations: [], error: 'Failed to fetch water quality data' }, { status: 500 });
  }
}
