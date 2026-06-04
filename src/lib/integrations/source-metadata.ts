export type OsirisSeverity = 'low' | 'medium' | 'high' | 'critical';

export type SourceStatus = 'ok' | 'partial' | 'disabled' | 'error';

export type OsirisSourceMeta = {
  provider: string;
  feed: string;
  url?: string;
  attribution?: string;
  license?: string;
  fetchedAt: string;
  observedAt?: string;
  cacheTtlSeconds: number;
  confidence: number;
};

export type IntegrationSourceStatus = {
  enabled: boolean;
  status: SourceStatus;
  provider: string;
  message?: string;
  url?: string;
  fetchedAt: string;
};

export function sourceMeta(input: Omit<OsirisSourceMeta, 'fetchedAt'> & { fetchedAt?: string }): OsirisSourceMeta {
  return {
    ...input,
    fetchedAt: input.fetchedAt || new Date().toISOString(),
  };
}

export function disabledSourceStatus(provider: string, message: string, url?: string): IntegrationSourceStatus {
  return {
    enabled: false,
    status: 'disabled',
    provider,
    message,
    url,
    fetchedAt: new Date().toISOString(),
  };
}

export function okSourceStatus(provider: string, url?: string): IntegrationSourceStatus {
  return {
    enabled: true,
    status: 'ok',
    provider,
    url,
    fetchedAt: new Date().toISOString(),
  };
}

export function errorSourceStatus(provider: string, message: string, url?: string): IntegrationSourceStatus {
  return {
    enabled: true,
    status: 'error',
    provider,
    message,
    url,
    fetchedAt: new Date().toISOString(),
  };
}
