import { NextResponse } from 'next/server';
import { fetchUrlhausRecent } from '@/lib/integrations/threat-intel';
import {
  errorSourceStatus,
  okSourceStatus,
} from '@/lib/integrations/source-metadata';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || searchParams.get('host') || searchParams.get('url') || undefined;

  try {
    const matches = await fetchUrlhausRecent(query);
    return NextResponse.json({
      query: query || null,
      matches,
      total: matches.length,
      timestamp: new Date().toISOString(),
      sources: {
        urlhaus: okSourceStatus('URLhaus', 'https://urlhaus.abuse.ch/downloads/csv_recent/'),
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'URLhaus lookup failed';
    return NextResponse.json({
      query: query || null,
      matches: [],
      total: 0,
      timestamp: new Date().toISOString(),
      sources: {
        urlhaus: errorSourceStatus('URLhaus', message, 'https://urlhaus.abuse.ch/downloads/csv_recent/'),
      },
      error: message,
    }, { status: 502 });
  }
}
