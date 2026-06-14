'use client';

/**
 * ═══════════════════════════════════════════════════════════════
 *  OSIRIS — Plugin Console
 *  Admin-only management surface for the third-party plugin system.
 *
 *   • INSTALLED — enable / disable / run / uninstall hot-loaded plugins.
 *   • INSTALL   — paste a manifest (or load a starter template) to
 *                 register a new plugin into the running system.
 *   • RENDER    — embed sandboxed visualization-plugin widgets.
 *
 *  All mutations go through /api/plugins and take effect immediately —
 *  no rebuild, no restart.
 * ═══════════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Puzzle, Package, Plus, RefreshCw, Loader2, Play, Trash2, Power,
  Database, BarChart3, Sparkles, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import type { InstalledPlugin, PluginExecResult, PluginKind } from '@/lib/plugins/types';

type Tab = 'installed' | 'install' | 'render';

const KIND_META: Record<PluginKind, { label: string; color: string; Icon: typeof Database }> = {
  'data-source': { label: 'DATA SOURCE', color: '#00E5FF', Icon: Database },
  'visualization': { label: 'VISUALIZATION', color: '#B388FF', Icon: BarChart3 },
  'ai-pipeline': { label: 'AI PIPELINE', color: '#D4AF37', Icon: Sparkles },
};

// Starter manifests — one per kind — so an admin can install something
// real in two clicks and learn the manifest shape by example.
const TEMPLATES: { label: string; manifest: Record<string, unknown> }[] = [
  {
    label: 'USGS Quakes (data-source)',
    manifest: {
      id: 'osiris.usgs-quakes',
      name: 'USGS Significant Quakes',
      version: '1.0.0',
      kind: 'data-source',
      author: 'OSIRIS',
      description: 'Live significant earthquakes from the USGS GeoJSON feed.',
      permissions: { network: ['earthquake.usgs.gov'] },
      dataSource: {
        url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson',
        method: 'GET',
        refreshSeconds: 900,
        mapping: {
          itemsPath: 'features',
          fields: {
            id: 'id',
            name: 'properties.title',
            lat: 'geometry.coordinates.1',
            lng: 'geometry.coordinates.0',
          },
          defaults: { domain: 'LAND', entityType: 'EVENT', threat: 'ELEVATED', color: '#FF6B35', icon: 'quake' },
        },
      },
    },
  },
  {
    label: 'Embedded Widget (visualization)',
    manifest: {
      id: 'osiris.embed-widget',
      name: 'Embedded Analyst Widget',
      version: '1.0.0',
      kind: 'visualization',
      author: 'OSIRIS',
      description: 'Renders an external dashboard in a sandboxed iframe widget.',
      visualization: { widget: 'iframe', url: 'https://example.com/widget' },
    },
  },
  {
    label: 'Threat Summarizer (ai-pipeline)',
    manifest: {
      id: 'osiris.threat-summarizer',
      name: 'Threat Summarizer',
      version: '1.0.0',
      kind: 'ai-pipeline',
      author: 'OSIRIS',
      description: 'Two-step pipeline: extract entities, then write a threat assessment.',
      permissions: { ai: true },
      aiPipeline: {
        system: 'You are an OSINT analyst. Be concise and factual.',
        steps: [
          { id: 'extract', prompt: 'Extract the key entities (people, places, orgs) from this text:\n\n{{input}}' },
          { id: 'assess', prompt: 'Given these entities:\n{{extract}}\n\nWrite a 3-sentence threat assessment.' },
        ],
      },
    },
  },
];

interface Props {
  show: boolean;
  onClose: () => void;
}

// Hoisted out of the panel so it isn't re-created on every render.
function TabBtn({ active, label, color, onClick }: { active: boolean; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 text-[8px] font-mono transition-colors"
      style={{
        backgroundColor: active ? `${color}26` : 'rgba(255,255,255,0.03)',
        color: active ? color : 'rgba(255,255,255,0.5)',
      }}>
      {label}
    </button>
  );
}

export default function PluginPanel({ show, onClose }: Props) {
  const { token, user, hasRole } = useAuth();
  const [tab, setTab] = useState<Tab>('installed');
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ id: string; result: PluginExecResult } | null>(null);
  const [renderId, setRenderId] = useState<string | null>(null);

  // Install form
  const [manifestText, setManifestText] = useState('');
  const [installMsg, setInstallMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/plugins');
      const data = await res.json();
      if (res.ok) setPlugins(data.plugins || []);
      else setError(data.error || 'Failed to load plugins');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (show) load(); }, [show, load]);

  const mutate = useCallback(async (payload: Record<string, unknown>, id?: string) => {
    setBusyId(id || 'global'); setError(null);
    try {
      const res = await fetch('/api/plugins', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Request failed'); return null; }
      if (data.plugins) setPlugins(data.plugins);
      return data;
    } catch {
      setError('Network error');
      return null;
    } finally {
      setBusyId(null);
    }
  }, [authHeaders]);

  const run = useCallback(async (plugin: InstalledPlugin) => {
    setBusyId(plugin.id); setError(null); setRunResult(null);
    const input = plugin.kind === 'ai-pipeline'
      ? (window.prompt(`Input for "${plugin.name}":`, '') ?? '')
      : undefined;
    try {
      const res = await fetch('/api/plugins', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ action: 'execute', id: plugin.id, input }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setRunResult({ id: plugin.id, result: data.result });
        if (data.plugin) setPlugins(prev => prev.map(p => p.id === plugin.id ? data.plugin : p));
      } else setError(data.error || 'Execution failed');
    } catch {
      setError('Network error');
    } finally {
      setBusyId(null);
    }
  }, [authHeaders]);

  const install = useCallback(async (raw: string) => {
    setInstallMsg(null);
    let manifest: unknown;
    try { manifest = JSON.parse(raw); }
    catch { setInstallMsg({ ok: false, text: 'Manifest is not valid JSON' }); return; }
    const data = await mutate({ action: 'install', manifest });
    if (data?.success) {
      setInstallMsg({ ok: true, text: `Installed "${data.plugin.name}" — live now` });
      setManifestText('');
      setTab('installed');
    } else {
      setInstallMsg({ ok: false, text: error || 'Install rejected (see validation rules)' });
    }
  }, [mutate, error]);

  const vizPlugins = useMemo(
    () => plugins.filter(p => p.kind === 'visualization' && p.visualization?.widget === 'iframe' && p.status === 'enabled'),
    [plugins],
  );
  const renderTarget = useMemo(
    () => vizPlugins.find(p => p.id === renderId) || vizPlugins[0],
    [vizPlugins, renderId],
  );

  if (!show) return null;
  if (!hasRole('admin')) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[450] flex flex-col"
      style={{ background: 'radial-gradient(ellipse at center, #0a0a14 0%, #050508 100%)' }}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-3">
          <Puzzle className="w-4 h-4 text-[#B388FF]" />
          <span className="text-[12px] font-mono font-bold tracking-[0.2em] text-[#B388FF]">PLUGIN CONSOLE</span>
          <span className="text-[9px] font-mono text-white/40">SIGNED IN AS {user?.username?.toUpperCase()}</span>
          <span className="text-[9px] font-mono text-white/30">· {plugins.length} INSTALLED</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded overflow-hidden border border-white/10">
            <TabBtn active={tab === 'installed'} label="INSTALLED" color="#B388FF" onClick={() => setTab('installed')} />
            <TabBtn active={tab === 'install'} label="INSTALL" color="#00E676" onClick={() => setTab('install')} />
            <TabBtn active={tab === 'render'} label="RENDER" color="#00E5FF" onClick={() => setTab('render')} />
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#FF1744]/20 rounded transition-colors">
            <X className="w-4 h-4 text-[#FF1744]" />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-1.5 bg-[#FF1744]/15 border-b border-[#FF1744]/30">
          <span className="text-[8px] font-mono text-[#FF1744] flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> {error}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto styled-scrollbar p-4">
        {/* ── INSTALLED ── */}
        {tab === 'installed' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono font-bold text-white/80 tracking-wider">INSTALLED PLUGINS</span>
              <button onClick={load} className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono text-white/60 hover:text-white bg-white/5 hover:bg-white/10">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> REFRESH
              </button>
            </div>

            {plugins.length === 0 && !loading && (
              <div className="rounded border border-dashed border-white/10 p-8 text-center">
                <Package className="w-6 h-6 text-white/20 mx-auto mb-2" />
                <p className="text-[9px] font-mono text-white/30">No plugins installed. Use the INSTALL tab to add one.</p>
              </div>
            )}

            <div className="space-y-2">
              {plugins.map(p => {
                const meta = KIND_META[p.kind];
                const enabled = p.status === 'enabled';
                const isBusy = busyId === p.id;
                return (
                  <div key={p.id} className="rounded border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <meta.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                          <span className="text-[11px] font-mono font-bold text-white/90 truncate">{p.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-mono" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>{meta.label}</span>
                          <span className="text-[8px] font-mono text-white/30">v{p.version}</span>
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-mono"
                            style={{ backgroundColor: enabled ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.06)', color: enabled ? '#00E676' : 'rgba(255,255,255,0.4)' }}>
                            {enabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-[8px] font-mono text-white/40 mt-1">{p.id}</p>
                        {p.description && <p className="text-[8px] font-mono text-white/50 mt-1 leading-relaxed">{p.description}</p>}
                        {p.lastRun && (
                          <p className="text-[7px] font-mono mt-1" style={{ color: p.lastRun.ok ? '#00E676' : '#FF6B6B' }}>
                            LAST RUN {new Date(p.lastRun.at).toLocaleTimeString()} · {p.lastRun.summary} · {p.lastRun.durationMs}ms
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {p.kind !== 'visualization' && (
                          <button onClick={() => run(p)} disabled={isBusy || !enabled}
                            title="Run now"
                            className="p-1.5 rounded bg-[#00E5FF]/10 border border-[#00E5FF]/25 text-[#00E5FF] hover:bg-[#00E5FF]/20 disabled:opacity-30">
                            {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          </button>
                        )}
                        <button onClick={() => mutate({ action: enabled ? 'disable' : 'enable', id: p.id }, p.id)} disabled={isBusy}
                          title={enabled ? 'Disable' : 'Enable'}
                          className="p-1.5 rounded bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30">
                          <Power className="w-3 h-3" />
                        </button>
                        <button onClick={() => { if (window.confirm(`Uninstall "${p.name}"?`)) mutate({ action: 'uninstall', id: p.id }, p.id); }} disabled={isBusy}
                          title="Uninstall"
                          className="p-1.5 rounded bg-[#FF1744]/10 border border-[#FF1744]/25 text-[#FF1744] hover:bg-[#FF1744]/20 disabled:opacity-30">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {runResult?.id === p.id && (
                      <div className="mt-2 rounded bg-black/40 border border-white/10 p-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          {runResult.result.ok
                            ? <CheckCircle2 className="w-3 h-3 text-[#00E676]" />
                            : <AlertTriangle className="w-3 h-3 text-[#FF6B6B]" />}
                          <span className="text-[8px] font-mono" style={{ color: runResult.result.ok ? '#00E676' : '#FF6B6B' }}>
                            {runResult.result.ok ? 'OK' : 'FAILED'} · {runResult.result.durationMs}ms
                          </span>
                        </div>
                        {runResult.result.error && <p className="text-[8px] font-mono text-[#FF6B6B]">{runResult.result.error}</p>}
                        {runResult.result.kind === 'data-source' && runResult.result.ok && (
                          <p className="text-[8px] font-mono text-white/60">{runResult.result.accepted} entities ingested into the COP.</p>
                        )}
                        {runResult.result.output && (
                          <pre className="text-[8px] font-mono text-white/70 whitespace-pre-wrap max-h-48 overflow-y-auto styled-scrollbar">{runResult.result.output}</pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── INSTALL ── */}
        {tab === 'install' && (
          <div className="max-w-3xl mx-auto">
            <span className="text-[11px] font-mono font-bold text-white/80 tracking-wider">INSTALL FROM MANIFEST</span>
            <p className="text-[8px] font-mono text-white/40 mt-1 mb-3 leading-relaxed">
              Paste a plugin manifest (JSON). It is validated, then hot-loaded into the running system — no rebuild required.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => setManifestText(JSON.stringify(t.manifest, null, 2))}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/25 hover:bg-[#00E676]/20">
                  <Plus className="w-3 h-3" /> {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={manifestText} onChange={e => setManifestText(e.target.value)}
              rows={18} spellCheck={false}
              placeholder='{ "id": "acme.feed", "name": "...", "version": "1.0.0", "kind": "data-source", ... }'
              className="w-full bg-black/50 text-[9px] font-mono text-white/80 px-3 py-2 rounded border border-white/10 focus:border-[#B388FF] outline-none resize-none"
            />

            {installMsg && (
              <div className="mt-2 px-3 py-1.5 rounded border text-[8px] font-mono flex items-center gap-1.5"
                style={{
                  backgroundColor: installMsg.ok ? 'rgba(0,230,118,0.12)' : 'rgba(255,23,68,0.12)',
                  borderColor: installMsg.ok ? 'rgba(0,230,118,0.3)' : 'rgba(255,23,68,0.3)',
                  color: installMsg.ok ? '#00E676' : '#FF1744',
                }}>
                {installMsg.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {installMsg.text}
              </div>
            )}

            <button onClick={() => install(manifestText)} disabled={!manifestText.trim() || busyId === 'global'}
              className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded text-[9px] font-mono font-bold text-[#B388FF] bg-[#B388FF]/15 border border-[#B388FF]/30 hover:bg-[#B388FF]/25 disabled:opacity-30">
              {busyId === 'global' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />} INSTALL PLUGIN
            </button>
          </div>
        )}

        {/* ── RENDER ── */}
        {tab === 'render' && (
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            {vizPlugins.length === 0 ? (
              <div className="rounded border border-dashed border-white/10 p-8 text-center">
                <BarChart3 className="w-6 h-6 text-white/20 mx-auto mb-2" />
                <p className="text-[9px] font-mono text-white/30">No enabled iframe-visualization plugins. Install one to render it here.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {vizPlugins.map(p => (
                    <button key={p.id} onClick={() => setRenderId(p.id)}
                      className="px-2 py-1 rounded text-[8px] font-mono"
                      style={{
                        backgroundColor: renderTarget?.id === p.id ? 'rgba(179,136,255,0.2)' : 'rgba(255,255,255,0.03)',
                        color: renderTarget?.id === p.id ? '#B388FF' : 'rgba(255,255,255,0.5)',
                        border: `1px solid ${renderTarget?.id === p.id ? 'rgba(179,136,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      }}>
                      {p.name}
                    </button>
                  ))}
                </div>
                {renderTarget?.visualization?.url && (
                  <iframe
                    key={renderTarget.id}
                    src={renderTarget.visualization.url}
                    title={renderTarget.name}
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    referrerPolicy="no-referrer"
                    className="flex-1 w-full min-h-[420px] rounded border border-white/10 bg-black"
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
