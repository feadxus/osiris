/**
 * ═══════════════════════════════════════════════════════════════
 *  OSIRIS — Plugin System: Type Contract
 *
 *  A third-party plugin is a *declarative manifest* — not arbitrary
 *  code — so it can be hot-loaded into a running OSIRIS instance
 *  without rebuilding the core and without granting code execution.
 *
 *  Three plugin kinds:
 *   • data-source    — polls an external endpoint and maps the
 *                      response into PolybolosEntity[] for the COP.
 *   • visualization  — contributes a UI widget (sandboxed iframe, or
 *                      a map entity-layer fed by a data-source plugin).
 *   • ai-pipeline    — a chain of prompt steps executed against the
 *                      OSIRIS AI engine, threading each output forward.
 * ═══════════════════════════════════════════════════════════════
 */

import type { PolybolosEntity } from '@/lib/sdk/types';

export type PluginKind = 'data-source' | 'visualization' | 'ai-pipeline';

export type PluginStatus = 'enabled' | 'disabled';

export const PLUGIN_KINDS: PluginKind[] = ['data-source', 'visualization', 'ai-pipeline'];

/** Capabilities a plugin declares it needs. Surfaced to the admin at install time. */
export interface PluginPermissions {
  /** Outbound host patterns the plugin intends to reach (informational; egress is still SSRF-guarded). */
  network?: string[];
  /** Whether the plugin invokes the AI engine. */
  ai?: boolean;
}

/**
 * Declarative mapping that turns one external JSON record into a
 * PolybolosEntity. Field values are dot-paths into the record
 * (e.g. "geo.lat", "props.0.id").
 */
export interface FieldMapping {
  /** Dot-path to the array of records inside the response. Empty ⇒ the response itself is the array. */
  itemsPath?: string;
  fields: {
    id: string;
    name?: string;
    lat: string;
    lng: string;
    alt?: string;
    heading?: string;
    speed?: string;
    timestamp?: string;
  };
  /** Static values applied to every produced entity. */
  defaults?: {
    domain?: string;
    entityType?: string;
    threat?: string;
    classification?: string;
    color?: string;
    icon?: string;
    layerType?: 'circle' | 'symbol' | 'line';
  };
}

export interface DataSourceSpec {
  /** Endpoint to poll. Re-validated by the SSRF guard before every request. */
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  /** Suggested poll cadence in seconds (host scheduler honours it; informational). */
  refreshSeconds?: number;
  mapping: FieldMapping;
}

export type VizWidgetType = 'iframe' | 'entity-layer';

export interface VisualizationSpec {
  widget: VizWidgetType;
  /** `iframe` widgets — sandboxed URL to embed. */
  url?: string;
  /** `entity-layer` widgets — id of the data-source plugin that feeds it. */
  dataSourceId?: string;
  display?: {
    color?: string;
    icon?: string;
    layerType?: 'circle' | 'symbol' | 'line';
  };
}

export interface AiPipelineStep {
  id: string;
  /** Prompt template. `{{input}}` and `{{<priorStepId>}}` placeholders are interpolated at run time. */
  prompt: string;
}

export interface AiPipelineSpec {
  steps: AiPipelineStep[];
  /** System prompt prepended to every step. */
  system?: string;
}

export interface PluginManifest {
  /** Stable unique id in reverse-dns-ish form, e.g. "acme.weather-radar". */
  id: string;
  name: string;
  version: string;
  kind: PluginKind;
  author?: string;
  description?: string;
  permissions?: PluginPermissions;
  dataSource?: DataSourceSpec;
  visualization?: VisualizationSpec;
  aiPipeline?: AiPipelineSpec;
}

export interface PluginRunRecord {
  at: string;
  ok: boolean;
  summary: string;
  durationMs: number;
}

export interface InstalledPlugin extends PluginManifest {
  status: PluginStatus;
  installedAt: string;
  updatedAt: string;
  lastRun?: PluginRunRecord;
}

export interface PluginExecResult {
  ok: boolean;
  kind: PluginKind;
  /** data-source result */
  entities?: PolybolosEntity[];
  accepted?: number;
  /** ai-pipeline result */
  output?: string;
  steps?: { id: string; output: string }[];
  error?: string;
  durationMs: number;
  timestamp: string;
}

/** Public-facing manifest view (no behavioural difference, but kept distinct for clarity). */
export type PluginSummary = InstalledPlugin;
