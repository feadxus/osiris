/**
 * ═══════════════════════════════════════════════════════════════
 *  OSIRIS — Plugin Registry
 *
 *  The runtime catalogue of installed plugins. Plugins are hot-loaded:
 *  install / enable / disable / uninstall all take effect immediately
 *  on the running process — no rebuild, no restart.
 *
 *  Persistence mirrors the auth store: a JSON file under a configurable
 *  data dir, with a process-wide in-memory cache (stored on globalThis
 *  so it survives Next.js dev hot-reloads).
 * ═══════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import {
  InstalledPlugin, PluginManifest, PluginStatus, PluginRunRecord,
  PLUGIN_KINDS,
} from './types';

const PLUGINS_DIR = process.env.PLUGINS_DIR || '/app/data/plugins';
const PLUGINS_FILE = path.join(PLUGINS_DIR, 'plugins.json');

// Reverse-dns-ish id: lowercase segments separated by dots.
const ID_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

// ── In-memory cache (survives dev hot-reload via globalThis) ──

const globalForPlugins = globalThis as unknown as {
  __osirisPluginCache?: Map<string, InstalledPlugin>;
};

function ensureDir(): void {
  try { fs.mkdirSync(PLUGINS_DIR, { recursive: true }); } catch { /* exists */ }
}

function loadFromDisk(): Map<string, InstalledPlugin> {
  ensureDir();
  try {
    const raw = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf-8')) as InstalledPlugin[];
    return new Map(raw.map(p => [p.id, p]));
  } catch {
    return new Map();
  }
}

function cache(): Map<string, InstalledPlugin> {
  if (!globalForPlugins.__osirisPluginCache) {
    globalForPlugins.__osirisPluginCache = loadFromDisk();
  }
  return globalForPlugins.__osirisPluginCache;
}

function persist(): void {
  ensureDir();
  try {
    fs.writeFileSync(PLUGINS_FILE, JSON.stringify([...cache().values()], null, 2), 'utf-8');
  } catch (err) {
    console.error('[Plugins] Failed to persist registry:', (err as Error).message);
  }
}

// ── Validation ──

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate a manifest before it is trusted. Rejects malformed ids,
 * unknown kinds, and kind/spec mismatches (e.g. a data-source plugin
 * with no dataSource block). Keeps a hot-loaded plugin from being
 * installed in a state the runtime can't execute.
 */
export function validateManifest(m: unknown): ValidationResult {
  if (!m || typeof m !== 'object') return { ok: false, error: 'Manifest must be a JSON object' };
  const p = m as Partial<PluginManifest>;

  if (!p.id || typeof p.id !== 'string' || !ID_RE.test(p.id)) {
    return { ok: false, error: 'Invalid id — use lowercase dotted segments, e.g. "acme.weather"' };
  }
  if (!p.name || typeof p.name !== 'string') return { ok: false, error: 'name is required' };
  if (!p.version || typeof p.version !== 'string') return { ok: false, error: 'version is required' };
  if (!p.kind || !PLUGIN_KINDS.includes(p.kind)) {
    return { ok: false, error: `kind must be one of: ${PLUGIN_KINDS.join(', ')}` };
  }

  if (p.kind === 'data-source') {
    const ds = p.dataSource;
    if (!ds || typeof ds.url !== 'string' || !ds.url) {
      return { ok: false, error: 'data-source plugins require dataSource.url' };
    }
    if (!ds.mapping?.fields?.id || !ds.mapping.fields.lat || !ds.mapping.fields.lng) {
      return { ok: false, error: 'data-source mapping requires fields.id, fields.lat, fields.lng' };
    }
    if (!/^https?:\/\//i.test(ds.url)) {
      return { ok: false, error: 'dataSource.url must be an http(s) URL' };
    }
  }

  if (p.kind === 'visualization') {
    const v = p.visualization;
    if (!v || (v.widget !== 'iframe' && v.widget !== 'entity-layer')) {
      return { ok: false, error: 'visualization.widget must be "iframe" or "entity-layer"' };
    }
    if (v.widget === 'iframe' && !/^https?:\/\//i.test(v.url || '')) {
      return { ok: false, error: 'iframe widgets require an http(s) visualization.url' };
    }
    if (v.widget === 'entity-layer' && !v.dataSourceId) {
      return { ok: false, error: 'entity-layer widgets require visualization.dataSourceId' };
    }
  }

  if (p.kind === 'ai-pipeline') {
    const ai = p.aiPipeline;
    if (!ai || !Array.isArray(ai.steps) || ai.steps.length === 0) {
      return { ok: false, error: 'ai-pipeline plugins require aiPipeline.steps[]' };
    }
    for (const s of ai.steps) {
      if (!s.id || typeof s.prompt !== 'string' || !s.prompt) {
        return { ok: false, error: 'each ai-pipeline step requires an id and a prompt' };
      }
    }
  }

  return { ok: true };
}

// ── Registry operations (all hot — effective immediately) ──

export function listPlugins(): InstalledPlugin[] {
  return [...cache().values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPlugin(id: string): InstalledPlugin | undefined {
  return cache().get(id);
}

export interface InstallResult {
  ok: boolean;
  plugin?: InstalledPlugin;
  error?: string;
}

/**
 * Install (or upgrade) a plugin from a manifest. Idempotent on id:
 * re-installing the same id upgrades in place, preserving install date
 * and current enabled/disabled status.
 */
export function installPlugin(manifest: PluginManifest): InstallResult {
  const v = validateManifest(manifest);
  if (!v.ok) return { ok: false, error: v.error };

  const now = new Date().toISOString();
  const existing = cache().get(manifest.id);
  const plugin: InstalledPlugin = {
    ...manifest,
    status: existing?.status ?? 'enabled',
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    lastRun: existing?.lastRun,
  };
  cache().set(plugin.id, plugin);
  persist();
  return { ok: true, plugin };
}

export function setPluginStatus(id: string, status: PluginStatus): InstallResult {
  const plugin = cache().get(id);
  if (!plugin) return { ok: false, error: 'Plugin not found' };
  plugin.status = status;
  plugin.updatedAt = new Date().toISOString();
  persist();
  return { ok: true, plugin };
}

export function uninstallPlugin(id: string): { ok: boolean; error?: string } {
  if (!cache().delete(id)) return { ok: false, error: 'Plugin not found' };
  persist();
  return { ok: true };
}

/** Record the outcome of the most recent execution for surfacing in the UI. */
export function recordRun(id: string, run: PluginRunRecord): void {
  const plugin = cache().get(id);
  if (!plugin) return;
  plugin.lastRun = run;
  persist();
}
