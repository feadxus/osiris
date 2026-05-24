import { NextRequest, NextResponse } from 'next/server';
import {
  MARKET_SOURCE_CATALOG_UPDATED_AT,
  marketResearchSources,
  marketSourceCategoryLabels,
  marketSourceCountsByCategory,
  marketSourceFilters,
} from '@/lib/market-research-sources';
import type {
  MarketSourceAccess,
  MarketSourceCadence,
  MarketSourceCategory,
  MarketSourceCoverage,
  MarketSourceStatus,
} from '@/lib/market-research-source-types';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

const isCategory = (value: string | null): value is MarketSourceCategory =>
  value !== null && marketSourceFilters.categories.includes(value as MarketSourceCategory);

const isAccess = (value: string | null): value is MarketSourceAccess =>
  value !== null && marketSourceFilters.access.includes(value as MarketSourceAccess);

const isCadence = (value: string | null): value is MarketSourceCadence =>
  value !== null && marketSourceFilters.cadences.includes(value as MarketSourceCadence);

const isCoverage = (value: string | null): value is MarketSourceCoverage =>
  value !== null && marketSourceFilters.coverage.includes(value as MarketSourceCoverage);

const isStatus = (value: string | null): value is MarketSourceStatus =>
  value !== null && marketSourceFilters.statuses.includes(value as MarketSourceStatus);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = isCategory(params.get('category')) ? params.get('category') : null;
  const access = isAccess(params.get('access')) ? params.get('access') : null;
  const cadence = isCadence(params.get('cadence')) ? params.get('cadence') : null;
  const coverage = isCoverage(params.get('coverage')) ? params.get('coverage') : null;
  const status = isStatus(params.get('status')) ? params.get('status') : null;
  const minPriority = Number(params.get('minPriority') || 0);

  const sources = marketResearchSources.filter(source => {
    if (category && source.category !== category) return false;
    if (access && source.access !== access) return false;
    if (cadence && source.cadence !== cadence) return false;
    if (coverage && source.coverage !== coverage) return false;
    if (status && source.status !== status) return false;
    if (Number.isFinite(minPriority) && source.scores.integrationPriority < minPriority) return false;
    return true;
  });

  return NextResponse.json({
    sources,
    total: sources.length,
    catalogTotal: marketResearchSources.length,
    filters: marketSourceFilters,
    labels: marketSourceCategoryLabels,
    countsByCategory: marketSourceCountsByCategory,
    updatedAt: MARKET_SOURCE_CATALOG_UPDATED_AT,
  }, {
    headers: CACHE_HEADERS,
  });
}
