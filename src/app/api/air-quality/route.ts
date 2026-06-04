import { NextResponse } from 'next/server';
import {
  buildOpenAqDisabledResponse,
  fetchOpenAqStations,
} from '@/lib/integrations/openaq';
import {
  errorSourceStatus,
  okSourceStatus,
} from '@/lib/integrations/source-metadata';

export const dynamic = 'force-dynamic';

/**
 * OSIRIS — Air Quality Monitoring API
 *
 * OpenAQ v1/v2 are retired and v3 requires an X-API-Key header. The route
 * stays non-failing without credentials so the dashboard can still boot.
 */
export async function GET() {
  const apiKey = process.env.OPENAQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(buildOpenAqDisabledResponse(), {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }

  try {
    const stations = await fetchOpenAqStations(apiKey);

    return NextResponse.json({
      enabled: true,
      stations,
      total: stations.length,
      timestamp: new Date().toISOString(),
      sources: {
        openaq: okSourceStatus('OpenAQ', 'https://api.openaq.org/v3/parameters/2/latest'),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch air quality data';

    return NextResponse.json({
      enabled: true,
      stations: [],
      total: 0,
      timestamp: new Date().toISOString(),
      sources: {
        openaq: errorSourceStatus('OpenAQ', message, 'https://api.openaq.org/v3/parameters/2/latest'),
      },
      error: message,
    }, {
      status: 502,
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  }
}
