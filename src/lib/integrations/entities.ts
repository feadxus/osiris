import { sourceMeta } from './source-metadata.ts';

export const GLEIF_LEI_RECORDS_URL = 'https://api.gleif.org/api/v1/lei-records';

type GleifLeiRecordInput = {
  id?: string;
  attributes?: {
    lei?: string;
    entity?: {
      legalName?: { name?: string };
      legalAddress?: {
        country?: string;
        city?: string;
      };
      headquartersAddress?: {
        country?: string;
        city?: string;
      };
      status?: string;
      legalForm?: {
        id?: string;
        other?: string;
      };
    };
    registration?: {
      status?: string;
      initialRegistrationDate?: string;
      lastUpdateDate?: string;
    };
  };
};

export type EntityResolutionResult = {
  id: string;
  lei?: string;
  name: string;
  status?: string;
  registrationStatus?: string;
  countryCode?: string;
  city?: string;
  legalForm?: string;
  registeredAt?: string;
  updatedAt?: string;
  source: ReturnType<typeof sourceMeta>;
};

export function normalizeGleifLeiRecord(record: GleifLeiRecordInput): EntityResolutionResult {
  const entity = record.attributes?.entity;
  const lei = record.attributes?.lei || record.id;
  const address = entity?.legalAddress || entity?.headquartersAddress;

  return {
    id: `gleif-${lei || record.id || 'entity'}`,
    lei,
    name: entity?.legalName?.name || 'Unknown legal entity',
    status: entity?.status,
    registrationStatus: record.attributes?.registration?.status,
    countryCode: address?.country,
    city: address?.city,
    legalForm: entity?.legalForm?.id || entity?.legalForm?.other,
    registeredAt: record.attributes?.registration?.initialRegistrationDate,
    updatedAt: record.attributes?.registration?.lastUpdateDate,
    source: sourceMeta({
      provider: 'GLEIF',
      feed: 'lei-records',
      url: GLEIF_LEI_RECORDS_URL,
      attribution: 'Global Legal Entity Identifier Foundation',
      license: 'GLEIF API Terms',
      observedAt: record.attributes?.registration?.lastUpdateDate,
      cacheTtlSeconds: 86400,
      confidence: 0.9,
    }),
  };
}

export async function fetchGleifEntities(query: string): Promise<EntityResolutionResult[]> {
  const params = new URLSearchParams({
    'filter[entity.legalName]': query,
    'page[size]': '10',
    sort: '-registration.initialRegistrationDate',
  });
  const res = await fetch(`${GLEIF_LEI_RECORDS_URL}?${params.toString()}`, {
    headers: { Accept: 'application/vnd.api+json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GLEIF HTTP ${res.status}`);

  const data = (await res.json()) as { data?: GleifLeiRecordInput[] };
  return (data.data || []).map(normalizeGleifLeiRecord);
}
