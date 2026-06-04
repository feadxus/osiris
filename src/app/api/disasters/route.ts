import { NextResponse } from 'next/server';
import {
  buildReliefWebDisabledStatus,
  fetchGdacsEvents,
  fetchReliefWebReports,
} from '@/lib/integrations/disasters';
import {
  errorSourceStatus,
  okSourceStatus,
} from '@/lib/integrations/source-metadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  const reliefWebAppName = process.env.RELIEFWEB_APP_NAME;

  const [gdacsResult, reliefWebResult] = await Promise.allSettled([
    fetchGdacsEvents(),
    reliefWebAppName ? fetchReliefWebReports(reliefWebAppName) : Promise.resolve(null),
  ]);

  const events = gdacsResult.status === 'fulfilled' ? gdacsResult.value : [];
  const reports = reliefWebResult.status === 'fulfilled' && reliefWebResult.value ? reliefWebResult.value : [];

  const gdacsSource = gdacsResult.status === 'fulfilled'
    ? okSourceStatus('GDACS', 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH')
    : errorSourceStatus(
        'GDACS',
        gdacsResult.reason instanceof Error ? gdacsResult.reason.message : 'GDACS fetch failed',
        'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
      );

  const reliefWebSource = reliefWebAppName
    ? (reliefWebResult.status === 'fulfilled'
        ? okSourceStatus('ReliefWeb', 'https://api.reliefweb.int/v2/reports')
        : errorSourceStatus(
            'ReliefWeb',
            reliefWebResult.reason instanceof Error ? reliefWebResult.reason.message : 'ReliefWeb fetch failed',
            'https://api.reliefweb.int/v2/reports',
          ))
    : buildReliefWebDisabledStatus();

  const sourceValues = [gdacsSource, reliefWebSource];
  const partial = sourceValues.some(source => source.status !== 'ok');

  return NextResponse.json({
    events,
    reports,
    total: events.length + reports.length,
    partial,
    timestamp: new Date().toISOString(),
    sources: {
      gdacs: gdacsSource,
      reliefweb: reliefWebSource,
    },
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
    },
  });
}
