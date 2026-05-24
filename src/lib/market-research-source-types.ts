export const MARKET_SOURCE_CATEGORIES = [
  'backbone',
  'cpg_retail',
  'pharma_health',
  'finance_macro',
  'policy_regulation',
  'live_risk',
] as const;

export type MarketSourceCategory = typeof MARKET_SOURCE_CATEGORIES[number];

export const MARKET_SOURCE_ACCESS = ['open', 'freemium', 'commercial', 'restricted'] as const;
export type MarketSourceAccess = typeof MARKET_SOURCE_ACCESS[number];

export const MARKET_SOURCE_AUTH = ['none', 'free_key', 'account_key', 'oauth', 'commercial_contract'] as const;
export type MarketSourceAuth = typeof MARKET_SOURCE_AUTH[number];

export const MARKET_SOURCE_CADENCES = [
  'real_time',
  'minutes',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annual',
  'release_calendar',
] as const;
export type MarketSourceCadence = typeof MARKET_SOURCE_CADENCES[number];

export const MARKET_SOURCE_COVERAGE = ['global', 'us', 'state_local', 'regional'] as const;
export type MarketSourceCoverage = typeof MARKET_SOURCE_COVERAGE[number];

export const MARKET_SOURCE_OUTPUTS = [
  'point_events',
  'poi_points',
  'choropleth',
  'polygons',
  'time_series',
  'docket_feed',
  'enrichment_table',
] as const;
export type MarketSourceOutput = typeof MARKET_SOURCE_OUTPUTS[number];

export const MARKET_SOURCE_GIS_MODES = [
  'coordinates',
  'bbox',
  'boundary_join',
  'address_geocode',
  'not_spatial_native',
] as const;
export type MarketSourceGisMode = typeof MARKET_SOURCE_GIS_MODES[number];

export const MARKET_SOURCE_STATUSES = ['ready', 'candidate', 'commercial_candidate', 'restricted_candidate'] as const;
export type MarketSourceStatus = typeof MARKET_SOURCE_STATUSES[number];

export interface MarketSourceScores {
  sourceAuthority: number;
  domainFit: number;
  gisReadiness: number;
  freshness: number;
  apiReadiness: number;
  licenseSafety: number;
  integrationPriority: number;
}

export interface MarketSourceLocation {
  label: string;
  lat: number;
  lng: number;
}

export interface MarketResearchSource {
  id: string;
  name: string;
  provider: string;
  category: MarketSourceCategory;
  summary: string;
  coverage: MarketSourceCoverage;
  gisMode: MarketSourceGisMode;
  output: MarketSourceOutput;
  endpointUrl: string;
  docsUrl: string;
  auth: MarketSourceAuth;
  access: MarketSourceAccess;
  cadence: MarketSourceCadence;
  spatialResolution: string;
  joinKeys: readonly string[];
  licenseNotes: string;
  caveats: readonly string[];
  location: MarketSourceLocation;
  bbox: readonly [number, number, number, number] | null;
  status: MarketSourceStatus;
  scores: MarketSourceScores;
}

export interface MarketSourceFilters {
  categories: readonly MarketSourceCategory[];
  access: readonly MarketSourceAccess[];
  auth: readonly MarketSourceAuth[];
  cadences: readonly MarketSourceCadence[];
  coverage: readonly MarketSourceCoverage[];
  outputs: readonly MarketSourceOutput[];
  statuses: readonly MarketSourceStatus[];
}
