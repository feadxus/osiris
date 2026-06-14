/**
 * ═══════════════════════════════════════════════════════════════
 *  OSIRIS — Plugin Runtime
 *
 *  Executes hot-loaded plugins. Plugins are declarative, so "execution"
 *  here means: take a manifest's spec and drive the existing OSIRIS
 *  subsystems with it.
 *
 *   • data-source  → SSRF-guarded fetch + declarative field mapping
 *                    into PolybolosEntity[], merged into the SDK COP
 *                    store (the same store the ingest webhook feeds).
 *   • ai-pipeline  → sequential prompt steps against the AI engine,
 *                    each step's output threaded into the next.
 * ═══════════════════════════════════════════════════════════════
 */

import { safeFetch } from '@/lib/ssrf-guard';
import { startLog } from '@/lib/event-logger';
import type { PolybolosEntity } from '@/lib/sdk/types';
import { recordRun } from './registry';
import type { InstalledPlugin, PluginExecResult } from './types';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

// Shared SDK entity store — the same global the /api/sdk/ingest + /stream
// endpoints use, so plugin-sourced entities flow into the Common Operating
// Picture exactly like any other external feed.
const globalForSDK = globalThis as unknown as {
  sdkEntityStore: Map<string, unknown>;
  sdkLastUpdate: number;
  sdkIngestLog: Array<{ source: string; count: number; timestamp: string }>;
};

function ensureSdkStore() {
  if (!globalForSDK.sdkEntityStore) {
    globalForSDK.sdkEntityStore = new Map();
    globalForSDK.sdkLastUpdate = Date.now();
  }
  if (!globalForSDK.sdkIngestLog) globalForSDK.sdkIngestLog = [];
}

/** Read a dot-path (e.g. "geo.lat", "items.0.id") out of an arbitrary object. */
function getByPath(obj: unknown, dotPath: string): unknown {
  if (!dotPath) return obj;
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function toNumber(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

// ── data-source execution ──

export async function executeDataSource(plugin: InstalledPlugin): Promise<PluginExecResult> {
  const started = Date.now();
  const ts = new Date().toISOString();
  const ds = plugin.dataSource!;
  const logDone = startLog('plugin-runtime', `data-source:${plugin.id}`, ds.url);

  try {
    const res = await safeFetch(ds.url, {
      method: ds.method || 'GET',
      headers: ds.headers,
      body: ds.method === 'POST' ? ds.body : undefined,
    });
    if (!res.ok) {
      logDone({ status: 'FAIL', error: `upstream ${res.status}` });
      const result: PluginExecResult = {
        ok: false, kind: 'data-source', error: `Upstream responded ${res.status}`,
        durationMs: Date.now() - started, timestamp: ts,
      };
      recordRun(plugin.id, { at: ts, ok: false, summary: result.error!, durationMs: result.durationMs });
      return result;
    }

    const json = await res.json();
    const { mapping } = ds;
    const rawItems = getByPath(json, mapping.itemsPath || '');
    const items = Array.isArray(rawItems) ? rawItems : [];

    ensureSdkStore();
    const entities: PolybolosEntity[] = [];
    const d = mapping.defaults || {};

    for (const item of items) {
      const id = getByPath(item, mapping.fields.id);
      const lat = toNumber(getByPath(item, mapping.fields.lat));
      const lng = toNumber(getByPath(item, mapping.fields.lng));
      if (id == null || lat === undefined || lng === undefined) continue;

      const entity: PolybolosEntity = {
        id: `plugin-${plugin.id}-${String(id)}`,
        name: mapping.fields.name ? String(getByPath(item, mapping.fields.name) ?? `ENTITY-${id}`) : `ENTITY-${id}`,
        domain: (d.domain as PolybolosEntity['domain']) || ('LAND' as PolybolosEntity['domain']),
        entityType: (d.entityType as PolybolosEntity['entityType']) || ('TRACK' as PolybolosEntity['entityType']),
        position: {
          lat, lng,
          alt: mapping.fields.alt ? toNumber(getByPath(item, mapping.fields.alt)) : undefined,
          heading: mapping.fields.heading ? toNumber(getByPath(item, mapping.fields.heading)) : undefined,
          speed: mapping.fields.speed ? toNumber(getByPath(item, mapping.fields.speed)) : undefined,
        },
        threat: (d.threat as PolybolosEntity['threat']) || ('NONE' as PolybolosEntity['threat']),
        classification: (d.classification as PolybolosEntity['classification']) || ('UNCLASSIFIED' as PolybolosEntity['classification']),
        source: {
          provider: plugin.id,
          feed: 'plugin',
          originalId: String(id),
          confidence: 0.7,
        },
        timestamp: mapping.fields.timestamp
          ? String(getByPath(item, mapping.fields.timestamp) ?? ts)
          : ts,
        properties: {},
        display: {
          color: d.color || '#D4AF37',
          icon: d.icon || 'dot-gold',
          layerType: d.layerType || 'circle',
          glow: false,
          scale: 1.0,
        },
      };
      entities.push(entity);
      globalForSDK.sdkEntityStore.set(entity.id, entity);
    }

    globalForSDK.sdkLastUpdate = Date.now();
    globalForSDK.sdkIngestLog.push({ source: `plugin:${plugin.id}`, count: entities.length, timestamp: ts });
    if (globalForSDK.sdkIngestLog.length > 100) {
      globalForSDK.sdkIngestLog = globalForSDK.sdkIngestLog.slice(-100);
    }

    logDone({ responseSummary: `${entities.length} entities from ${items.length} records` });
    const result: PluginExecResult = {
      ok: true, kind: 'data-source', entities, accepted: entities.length,
      durationMs: Date.now() - started, timestamp: ts,
    };
    recordRun(plugin.id, { at: ts, ok: true, summary: `${entities.length} entities ingested`, durationMs: result.durationMs });
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    logDone({ status: 'FAIL', error });
    const result: PluginExecResult = {
      ok: false, kind: 'data-source', error,
      durationMs: Date.now() - started, timestamp: ts,
    };
    recordRun(plugin.id, { at: ts, ok: false, summary: error, durationMs: result.durationMs });
    return result;
  }
}

// ── ai-pipeline execution ──

function resolveApiKey(userKey?: string): string | null {
  if (userKey?.trim()) return userKey.trim();
  for (let i = 1; i <= 8; i++) {
    const k = process.env[`DEEPSEEK_API_KEY_${i}`];
    if (k?.trim()) return k.trim();
  }
  return null;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}

async function chat(apiKey: string, system: string, prompt: string): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI API ${res.status}: ${errText.slice(0, 160)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function executeAiPipeline(
  plugin: InstalledPlugin,
  input: string,
  userKey?: string,
): Promise<PluginExecResult> {
  const started = Date.now();
  const ts = new Date().toISOString();
  const spec = plugin.aiPipeline!;
  const logDone = startLog('plugin-runtime', `ai-pipeline:${plugin.id}`, 'deepseek', `steps:${spec.steps.length}`);

  const apiKey = resolveApiKey(userKey);
  if (!apiKey) {
    logDone({ status: 'FAIL', error: 'no api key' });
    return { ok: false, kind: 'ai-pipeline', error: 'No AI API key configured', durationMs: Date.now() - started, timestamp: ts };
  }

  try {
    // vars accumulate: {{input}} plus each step output by its id, and {{prev}} = last output.
    const vars: Record<string, string> = { input };
    const steps: { id: string; output: string }[] = [];

    for (const step of spec.steps) {
      const prompt = interpolate(step.prompt, vars);
      const output = await chat(apiKey, spec.system || '', prompt);
      vars[step.id] = output;
      vars.prev = output;
      steps.push({ id: step.id, output });
    }

    const finalOutput = steps[steps.length - 1]?.output || '';
    logDone({ responseSummary: `${steps.length} steps, ${finalOutput.length} chars` });
    const result: PluginExecResult = {
      ok: true, kind: 'ai-pipeline', output: finalOutput, steps,
      durationMs: Date.now() - started, timestamp: ts,
    };
    recordRun(plugin.id, { at: ts, ok: true, summary: `${steps.length} steps completed`, durationMs: result.durationMs });
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    logDone({ status: 'FAIL', error });
    const result: PluginExecResult = {
      ok: false, kind: 'ai-pipeline', error,
      durationMs: Date.now() - started, timestamp: ts,
    };
    recordRun(plugin.id, { at: ts, ok: false, summary: error, durationMs: result.durationMs });
    return result;
  }
}

/** Dispatch by kind. Visualization plugins have no server-side execution. */
export async function executePlugin(
  plugin: InstalledPlugin,
  opts: { input?: string; userKey?: string } = {},
): Promise<PluginExecResult> {
  const ts = new Date().toISOString();
  if (plugin.status !== 'enabled') {
    return { ok: false, kind: plugin.kind, error: 'Plugin is disabled', durationMs: 0, timestamp: ts };
  }
  if (plugin.kind === 'data-source') return executeDataSource(plugin);
  if (plugin.kind === 'ai-pipeline') return executeAiPipeline(plugin, opts.input || '', opts.userKey);
  return { ok: false, kind: plugin.kind, error: 'Visualization plugins render client-side and have no server execution', durationMs: 0, timestamp: ts };
}
