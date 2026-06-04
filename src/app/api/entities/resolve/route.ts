import { NextResponse } from 'next/server';
import { fetchGleifEntities } from '@/lib/integrations/entities';
import {
  errorSourceStatus,
  okSourceStatus,
} from '@/lib/integrations/source-metadata';
import { search as searchSanctions } from '@/lib/sanctions';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('query') || searchParams.get('q') || '').trim();

  if (query.length < 3) {
    return NextResponse.json({ error: 'Missing query parameter with at least 3 characters' }, { status: 400 });
  }

  const [gleifResult, sanctionsResult] = await Promise.allSettled([
    fetchGleifEntities(query),
    searchSanctions(query, { limit: 10 }),
  ]);

  const entities = gleifResult.status === 'fulfilled' ? gleifResult.value : [];
  const sanctions = sanctionsResult.status === 'fulfilled' ? sanctionsResult.value : [];

  return NextResponse.json({
    query,
    entities,
    sanctions,
    total: entities.length,
    sanctions_total: sanctions.length,
    partial: gleifResult.status === 'rejected' || sanctionsResult.status === 'rejected',
    timestamp: new Date().toISOString(),
    sources: {
      gleif: gleifResult.status === 'fulfilled'
        ? okSourceStatus('GLEIF', 'https://api.gleif.org/api/v1/lei-records')
        : errorSourceStatus('GLEIF', gleifResult.reason instanceof Error ? gleifResult.reason.message : 'GLEIF lookup failed', 'https://api.gleif.org/api/v1/lei-records'),
      sanctions: sanctionsResult.status === 'fulfilled'
        ? okSourceStatus('OpenSanctions', 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/targets.simple.csv')
        : errorSourceStatus('OpenSanctions', sanctionsResult.reason instanceof Error ? sanctionsResult.reason.message : 'Sanctions lookup failed', 'https://data.opensanctions.org/datasets/latest/us_ofac_sdn/targets.simple.csv'),
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
  });
}
