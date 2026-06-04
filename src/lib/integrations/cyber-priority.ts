import { sourceMeta, type OsirisSeverity } from './source-metadata.ts';

export const EPSS_URL = 'https://api.first.org/data/v1/epss';
export const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export type EpssApiRecord = {
  cve?: string;
  epss?: string | number;
  percentile?: string | number;
  date?: string;
};

export type EpssRecord = {
  cve: string;
  epss: number;
  percentile: number;
  date?: string;
};

export type KevRecord = {
  cveID?: string;
  vulnerabilityName?: string;
  vendorProject?: string;
  product?: string;
  dateAdded?: string;
  dueDate?: string;
};

export type CyberPriority = OsirisSeverity;

export type CvePriorityRecord = {
  id: string;
  priority: CyberPriority;
  epss?: {
    probability: number;
    percentile: number;
    date?: string;
  };
  kev?: {
    known_exploited: boolean;
    name?: string;
    date_added?: string;
    due_date?: string;
    vendor?: string;
    product?: string;
  };
  cvss?: number | null;
  source: ReturnType<typeof sourceMeta>;
};

export function normalizeEpssRecord(record: EpssApiRecord): EpssRecord | null {
  if (!record.cve) return null;
  const epss = Number(record.epss);
  const percentile = Number(record.percentile);
  if (!Number.isFinite(epss) || !Number.isFinite(percentile)) return null;

  return {
    cve: record.cve.toUpperCase(),
    epss,
    percentile,
    date: record.date,
  };
}

export function scoreCyberPriority(input: {
  epss?: number;
  percentile?: number;
  isKnownExploited?: boolean;
  cvss?: number | null;
}): CyberPriority {
  const epss = input.epss ?? 0;
  const percentile = input.percentile ?? 0;
  const cvss = input.cvss ?? 0;

  if (input.isKnownExploited && (epss >= 0.5 || cvss >= 9)) return 'critical';
  if (epss >= 0.7 || percentile >= 0.97 || (input.isKnownExploited && cvss >= 7)) return 'critical';
  if (epss >= 0.2 || percentile >= 0.75 || cvss >= 7) return 'high';
  if (epss >= 0.03 || percentile >= 0.35 || cvss >= 4) return 'medium';
  return 'low';
}

export function mergeCvePriority(input: {
  cve: string;
  epss?: EpssRecord | null;
  kev?: KevRecord | null;
  cvss?: number | null;
}): CvePriorityRecord {
  const cve = input.cve.toUpperCase();
  const knownExploited = Boolean(input.kev);

  return {
    id: cve,
    priority: scoreCyberPriority({
      epss: input.epss?.epss,
      percentile: input.epss?.percentile,
      isKnownExploited: knownExploited,
      cvss: input.cvss,
    }),
    epss: input.epss
      ? {
          probability: input.epss.epss,
          percentile: input.epss.percentile,
          date: input.epss.date,
        }
      : undefined,
    kev: input.kev
      ? {
          known_exploited: true,
          name: input.kev.vulnerabilityName,
          date_added: input.kev.dateAdded,
          due_date: input.kev.dueDate,
          vendor: input.kev.vendorProject,
          product: input.kev.product,
        }
      : undefined,
    cvss: input.cvss ?? null,
    source: sourceMeta({
      provider: 'FIRST EPSS / CISA KEV',
      feed: 'cyber-priority',
      url: EPSS_URL,
      attribution: 'FIRST EPSS and CISA KEV',
      cacheTtlSeconds: 86400,
      confidence: knownExploited ? 0.95 : 0.85,
    }),
  };
}

export async function fetchEpss(cves: string[]): Promise<Map<string, EpssRecord>> {
  if (cves.length === 0) return new Map();
  const params = new URLSearchParams({ cve: cves.map(cve => cve.toUpperCase()).join(',') });
  const res = await fetch(`${EPSS_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`EPSS HTTP ${res.status}`);

  const data = (await res.json()) as { data?: EpssApiRecord[] };
  return new Map(
    (data.data || [])
      .map(normalizeEpssRecord)
      .filter((record): record is EpssRecord => Boolean(record))
      .map(record => [record.cve, record]),
  );
}

export async function fetchKevCatalog(): Promise<KevRecord[]> {
  const res = await fetch(CISA_KEV_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`CISA KEV HTTP ${res.status}`);

  const data = (await res.json()) as { vulnerabilities?: KevRecord[] };
  return data.vulnerabilities || [];
}
