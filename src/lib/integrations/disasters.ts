import {
  disabledSourceStatus,
  type IntegrationSourceStatus,
  type OsirisSeverity,
  sourceMeta,
} from './source-metadata.ts';

export const GDACS_EVENTS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH';
export const GDACS_RSS_URL = 'https://www.gdacs.org/xml/rss.xml';
export const RELIEFWEB_REPORTS_URL = 'https://api.reliefweb.int/v2/reports';

type GdacsFeature = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
  properties?: {
    eventtype?: string;
    eventid?: number | string;
    episodeid?: number | string;
    eventname?: string;
    name?: string;
    description?: string;
    htmldescription?: string;
    alertlevel?: string;
    alertLevel?: string;
    fromdate?: string;
    todate?: string;
    url?: string | { report?: string; details?: string; geometry?: string };
  };
};

export type DisasterEvent = {
  id: string;
  title: string;
  type: string;
  severity: OsirisSeverity;
  lat: number;
  lng: number;
  startedAt?: string;
  endedAt?: string;
  url?: string;
  source: ReturnType<typeof sourceMeta>;
};

type ReliefWebReportInput = {
  id?: string;
  fields?: {
    title?: string;
    url?: string;
    date?: { created?: string; original?: string };
    country?: { name?: string; iso3?: string }[];
    disaster?: { name?: string }[];
    source?: { name?: string }[];
  };
};

export type ReliefWebReport = {
  id: string;
  title: string;
  url?: string;
  published?: string;
  country?: string;
  countryCode?: string;
  disaster?: string;
  reportingSource?: string;
  source: ReturnType<typeof sourceMeta>;
};

export function normalizeGdacsSeverity(alertLevel?: string): OsirisSeverity {
  const normalized = (alertLevel || '').toLowerCase();
  if (normalized === 'red') return 'critical';
  if (normalized === 'orange') return 'high';
  if (normalized === 'green') return 'low';
  return 'medium';
}

export function normalizeGdacsFeature(feature: GdacsFeature): DisasterEvent | null {
  const coords = feature.geometry?.coordinates;
  const props = feature.properties || {};
  if (!coords || coords.length < 2 || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;

  const eventType = props.eventtype || 'event';
  const eventId = props.eventid || 'unknown';
  const episodeId = props.episodeid || 'latest';
  const url = typeof props.url === 'string' ? props.url : props.url?.report || props.url?.details;

  return {
    id: `gdacs-${eventType}-${eventId}-${episodeId}`,
    title: props.description || props.name || props.eventname || 'GDACS disaster event',
    type: eventType,
    severity: normalizeGdacsSeverity(props.alertlevel || props.alertLevel),
    lat: coords[1],
    lng: coords[0],
    startedAt: props.fromdate,
    endedAt: props.todate,
    url,
    source: sourceMeta({
      provider: 'GDACS',
      feed: 'event-list',
      url: GDACS_EVENTS_URL,
      attribution: 'Global Disaster Alert and Coordination System',
      license: 'GDACS public feed',
      observedAt: props.fromdate,
      cacheTtlSeconds: 900,
      confidence: 0.9,
    }),
  };
}

export function normalizeGdacsRssItem(itemXml: string): DisasterEvent | null {
  const lat = Number(readXmlTag(itemXml, 'geo:lat'));
  const lng = Number(readXmlTag(itemXml, 'geo:long'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const eventType = readXmlTag(itemXml, 'gdacs:eventtype') || 'event';
  const eventId = readXmlTag(itemXml, 'gdacs:eventid') || 'unknown';
  const episodeId = readXmlTag(itemXml, 'gdacs:episodeid') || 'latest';
  const pubDate = readXmlTag(itemXml, 'pubDate');

  return {
    id: `gdacs-rss-${eventType}-${eventId}-${episodeId}`,
    title: readXmlTag(itemXml, 'title') || 'GDACS disaster event',
    type: eventType,
    severity: normalizeGdacsSeverity(readXmlTag(itemXml, 'gdacs:alertlevel')),
    lat,
    lng,
    startedAt: readXmlTag(itemXml, 'gdacs:fromdate') || pubDate,
    endedAt: readXmlTag(itemXml, 'gdacs:todate'),
    url: readXmlTag(itemXml, 'link'),
    source: sourceMeta({
      provider: 'GDACS',
      feed: 'rss',
      url: GDACS_RSS_URL,
      attribution: 'Global Disaster Alert and Coordination System',
      license: 'GDACS public feed',
      observedAt: pubDate,
      cacheTtlSeconds: 900,
      confidence: 0.85,
    }),
  };
}

export function normalizeReliefWebReport(report: ReliefWebReportInput): ReliefWebReport {
  const fields = report.fields || {};
  const country = fields.country?.[0];

  return {
    id: `reliefweb-${report.id || encodeURIComponent(fields.url || fields.title || 'report')}`,
    title: fields.title || 'ReliefWeb report',
    url: fields.url,
    published: fields.date?.created || fields.date?.original,
    country: country?.name,
    countryCode: country?.iso3,
    disaster: fields.disaster?.[0]?.name,
    reportingSource: fields.source?.[0]?.name,
    source: sourceMeta({
      provider: 'ReliefWeb',
      feed: 'v2-reports',
      url: RELIEFWEB_REPORTS_URL,
      attribution: 'ReliefWeb / OCHA',
      license: 'ReliefWeb terms and source-specific rights',
      observedAt: fields.date?.created || fields.date?.original,
      cacheTtlSeconds: 1800,
      confidence: 0.85,
    }),
  };
}

export function buildReliefWebDisabledStatus(): IntegrationSourceStatus {
  return disabledSourceStatus(
    'ReliefWeb',
    'ReliefWeb v2 requires a pre-approved appname in RELIEFWEB_APP_NAME.',
    'https://apidoc.reliefweb.int/parameters#appname',
  );
}

export async function fetchGdacsEvents(): Promise<DisasterEvent[]> {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    eventtypes: 'EQ,TC,FL,VO',
    fromdate: from.toISOString().slice(0, 10),
    todate: to.toISOString().slice(0, 10),
  });

  try {
    const res = await fetch(`${GDACS_EVENTS_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`GDACS HTTP ${res.status}`);
    const data = (await res.json()) as { features?: GdacsFeature[] };
    return (data.features || []).map(normalizeGdacsFeature).filter((event): event is DisasterEvent => Boolean(event));
  } catch {
    return fetchGdacsRssEvents();
  }
}

export async function fetchGdacsRssEvents(): Promise<DisasterEvent[]> {
  const res = await fetch(GDACS_RSS_URL, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GDACS RSS HTTP ${res.status}`);

  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items
    .map(normalizeGdacsRssItem)
    .filter((event): event is DisasterEvent => Boolean(event));
}

export async function fetchReliefWebReports(appName: string): Promise<ReliefWebReport[]> {
  const res = await fetch(`${RELIEFWEB_REPORTS_URL}?appname=${encodeURIComponent(appName)}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit: 10,
      sort: ['date:desc'],
      fields: {
        include: ['title', 'url', 'date.created', 'date.original', 'country', 'disaster', 'source'],
      },
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`ReliefWeb HTTP ${res.status}`);
  const data = (await res.json()) as { data?: ReliefWebReportInput[] };
  return (data.data || []).map(normalizeReliefWebReport);
}

function readXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXml((match?.[1] || '').trim());
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
