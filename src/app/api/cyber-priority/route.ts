import { NextResponse } from 'next/server';
import {
  CISA_KEV_URL,
  EPSS_URL,
  fetchEpss,
  fetchKevCatalog,
  mergeCvePriority,
  type KevRecord,
} from '@/lib/integrations/cyber-priority';
import {
  errorSourceStatus,
  okSourceStatus,
} from '@/lib/integrations/source-metadata';

export const dynamic = 'force-dynamic';

const CVE_PATTERN = /^CVE-\d{4}-\d{4,}$/i;

function parseCves(req: Request): string[] {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('cves') || searchParams.get('cve') || '';
  return raw
    .split(',')
    .map(item => item.trim().toUpperCase())
    .filter(item => CVE_PATTERN.test(item))
    .slice(0, 50);
}

function newestKevCves(catalog: KevRecord[], limit = 20): string[] {
  return [...catalog]
    .sort((a, b) => new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime())
    .map(item => item.cveID?.toUpperCase())
    .filter((item): item is string => Boolean(item && CVE_PATTERN.test(item)))
    .slice(0, limit);
}

export async function GET(req: Request) {
  const explicitCves = parseCves(req);
  const sourceStatuses = {
    epss: okSourceStatus('FIRST EPSS', EPSS_URL),
    cisa_kev: okSourceStatus('CISA KEV', CISA_KEV_URL),
  };

  let kevCatalog: KevRecord[] = [];
  try {
    kevCatalog = await fetchKevCatalog();
  } catch (error) {
    sourceStatuses.cisa_kev = errorSourceStatus(
      'CISA KEV',
      error instanceof Error ? error.message : 'CISA KEV fetch failed',
      CISA_KEV_URL,
    );
  }

  const cves = explicitCves.length > 0 ? explicitCves : newestKevCves(kevCatalog);
  const kevByCve = new Map(kevCatalog.map(item => [item.cveID?.toUpperCase(), item] as const));

  let epssByCve = new Map();
  try {
    epssByCve = await fetchEpss(cves);
  } catch (error) {
    sourceStatuses.epss = errorSourceStatus(
      'FIRST EPSS',
      error instanceof Error ? error.message : 'EPSS fetch failed',
      EPSS_URL,
    );
  }

  const priorities = cves.map(cve => mergeCvePriority({
    cve,
    epss: epssByCve.get(cve),
    kev: kevByCve.get(cve),
  }));

  const stats = {
    total: priorities.length,
    critical: priorities.filter(item => item.priority === 'critical').length,
    high: priorities.filter(item => item.priority === 'high').length,
    medium: priorities.filter(item => item.priority === 'medium').length,
    low: priorities.filter(item => item.priority === 'low').length,
  };

  return NextResponse.json({
    priorities,
    stats,
    total: priorities.length,
    partial: Object.values(sourceStatuses).some(source => source.status !== 'ok'),
    timestamp: new Date().toISOString(),
    sources: sourceStatuses,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
