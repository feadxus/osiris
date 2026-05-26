export type DepDataset = 'ext' | 'prv' | 'nws' | 'vnd' | 'dds' | 'frm';

export const DATASET_COLORS: Record<DepDataset, string> = {
  ext: '#FF3D3D',
  prv: '#FF9500',
  dds: '#FFD700',
  nws: '#00E5FF',
  vnd: '#E040FB',
  frm: '#00E676',
};

export const DATASET_LABELS: Record<DepDataset, string> = {
  ext: 'RANSOMWARE',
  prv: 'PRIVACY',
  dds: 'DDOS',
  nws: 'OPEN NEWS',
  vnd: 'VANDALISM',
  frm: 'UNDERGROUND',
};

export interface DepPrivlistRecord {
  date: string;
  victim: string;
  sector: string | null;
  actor: string | null;
  country: string | null;
  revenue: string | null;
  amount: string | null;
  naics: string | null;
  site: string | null;
  hashid: string | null;
  annLink: string | null;
  annTitle: string | null;
  victimDomain: string | null;
  annDescription: string | null;
  annDataTypes: string[];
  victimCC: string | null;
  victimCity: string | null;
  victimState: string | null;
  victimAddress: string | null;
}

export interface DepGeoPoint {
  id: string;
  victim: string;
  sector: string | null;
  actor: string | null;
  date: string;
  site: string | null;
  dset: DepDataset;
  victimCC: string | null;
  victimCity: string | null;
  victimState: string | null;
  victimAddress: string | null;
  lat: number;
  lng: number;
  geocodeTier: 'city' | 'country';
}

export interface DepSearchResult {
  victim: string;
  sector: string | null;
  actor: string | null;
  country: string | null;
  domain: string | null;
  date: string | null;
  dset: string | null;
  annTitle: string | null;
  annDescription: string | null;
  annLink: string | null;
  hashid: string | null;
  victimCC: string | null;
  victimCity: string | null;
  victimState: string | null;
  executiveReport: string | null;
}
