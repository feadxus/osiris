import { NextResponse } from 'next/server';
import {
  type EpssRecord,
  fetchEpss,
  mergeCvePriority,
  type KevRecord,
} from '@/lib/integrations/cyber-priority';

// Cyber threat intelligence from public feeds
// Inspired by WorldMonitor's infrastructure tracking

export async function GET() {
  try {
    const results: {
      threats: {
        id?: string;
        name?: string;
        vendor?: string;
        product?: string;
        severity: string;
        date?: string;
        due?: string;
        source: string;
        priority?: string;
        epss?: { probability: number; percentile: number; date?: string };
      }[];
      stats: Record<string, number | string>;
      timestamp: string;
    } = { threats: [], stats: {}, timestamp: new Date().toISOString() };

    // 1. CISA Known Exploited Vulnerabilities (authoritative US govt source)
    try {
      const res = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = (await res.json()) as { vulnerabilities?: KevRecord[] };
        const recentKev = (data.vulnerabilities || [])
          .filter((v) => {
            const added = new Date(v.dateAdded || 0);
            const daysAgo = (Date.now() - added.getTime()) / (1000 * 60 * 60 * 24);
            return daysAgo <= 30;
          })
          .slice(0, 10);
        const recentCves = recentKev.map(v => v.cveID).filter((cve): cve is string => Boolean(cve));
        const epssByCve = await fetchEpss(recentCves).catch(() => new Map<string, EpssRecord>());
        const recent = recentKev.map((v) => {
          const priority = mergeCvePriority({
            cve: v.cveID || 'UNKNOWN',
            epss: v.cveID ? epssByCve.get(v.cveID.toUpperCase()) : null,
            kev: v,
          });

          return {
            id: v.cveID,
            name: v.vulnerabilityName,
            vendor: v.vendorProject,
            product: v.product,
            severity: 'CRITICAL',
            date: v.dateAdded,
            due: v.dueDate,
            source: 'CISA KEV',
            priority: priority.priority,
            epss: priority.epss,
          };
        });
        results.threats.push(...recent);
        results.stats.cisa_total = data.vulnerabilities?.length || 0;
        results.stats.priority_critical = recent.filter(threat => threat.priority === 'critical').length;
        results.stats.priority_high = recent.filter(threat => threat.priority === 'high').length;
      }
    } catch (e) {
      console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e);
    }

    // 2. Shadowserver honeypot stats (global attack surface)
    try {
      const res = await fetch('https://dashboard.shadowserver.org/statistics/combined/map/', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        results.stats.shadowserver = 'active';
      }
    } catch {
      results.stats.shadowserver = 'unavailable';
    }

    // 3. Aggregate stats
    results.stats.active_cves = results.threats.length;
    results.stats.threat_level = results.threats.length >= 8 ? 'CRITICAL' : results.threats.length >= 4 ? 'HIGH' : 'ELEVATED';

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ threats: [], stats: {}, error: 'Failed' }, { status: 500 });
  }
}
