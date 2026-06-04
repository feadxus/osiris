import { sourceMeta } from './source-metadata.ts';

export const URLHAUS_RECENT_CSV_URL = 'https://urlhaus.abuse.ch/downloads/csv_recent/';

export type UrlhausRecentItem = {
  id: string;
  dateAdded?: string;
  url: string;
  host: string;
  status: string;
  lastOnline?: string;
  threat: string;
  tags: string[];
  urlhausLink?: string;
  reporter?: string;
  source: ReturnType<typeof sourceMeta>;
};

export function normalizeUrlhausCsvLine(line: string): UrlhausRecentItem | null {
  const fields = parseCsvLine(line);
  if (fields.length < 9 || fields[0].startsWith('#')) return null;

  const url = fields[2];
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }

  return {
    id: `urlhaus-${fields[0]}`,
    dateAdded: fields[1],
    url,
    host,
    status: fields[3],
    lastOnline: fields[4],
    threat: fields[5],
    tags: fields[6] ? fields[6].split(',').map(tag => tag.trim()).filter(Boolean) : [],
    urlhausLink: fields[7],
    reporter: fields[8],
    source: sourceMeta({
      provider: 'URLhaus',
      feed: 'recent-csv',
      url: URLHAUS_RECENT_CSV_URL,
      attribution: 'abuse.ch URLhaus',
      license: 'URLhaus Terms of Use',
      observedAt: fields[1],
      cacheTtlSeconds: 300,
      confidence: 0.85,
    }),
  };
}

export async function fetchUrlhausRecent(query?: string): Promise<UrlhausRecentItem[]> {
  const res = await fetch(URLHAUS_RECENT_CSV_URL, {
    headers: { Accept: 'text/csv' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`URLhaus CSV HTTP ${res.status}`);

  const normalizedQuery = query?.toLowerCase();
  const items = (await res.text())
    .split('\n')
    .map(normalizeUrlhausCsvLine)
    .filter((item): item is UrlhausRecentItem => Boolean(item));

  return (normalizedQuery
    ? items.filter(item => item.url.toLowerCase().includes(normalizedQuery) || item.host.toLowerCase().includes(normalizedQuery))
    : items).slice(0, 100);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}
