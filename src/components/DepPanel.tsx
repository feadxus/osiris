'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Search, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react';

const DSET_COLORS: Record<string, string> = {
  ext: '#FF3D3D', prv: '#FF9500', dds: '#FFD700',
  nws: '#00E5FF', vnd: '#E040FB', frm: '#00E676',
};
const DSET_LABELS: Record<string, string> = {
  ext: 'RANSOMWARE', prv: 'PRIVACY', dds: 'DDOS',
  nws: 'NEWS', vnd: 'VANDALISM', frm: 'UNDERGROUND',
};

export default function DepPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState<'keyw' | 'domain'>('keyw');
  const [dset, setDset] = useState('ext');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setResults([]);
    try {
      const param = queryType === 'domain'
        ? `domain=${encodeURIComponent(query.trim())}`
        : `keyw=${encodeURIComponent(query.trim())}`;
      const res = await fetch(`/api/dep/search?${param}&dset=${dset}&maxres=20`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Search failed'); return; }
      setResults(data.results || []);
      setSearched(true);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [query, queryType, dset]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="glass-panel overflow-hidden"
    >
      <button
        onClick={() => setIsOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF3D3D] animate-osiris-pulse" />
          <Shield className="w-3.5 h-3.5 text-[#FF3D3D]" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--text-primary)]">DEP THREAT SEARCH</span>
        </div>
        <div className="flex items-center gap-2">
          {searched && results.length > 0 && (
            <span className="text-[9px] font-mono text-[#FF3D3D] font-bold">{results.length} HITS</span>
          )}
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5 border-t border-[var(--border-primary)]">
              <div className="flex gap-2 pt-2.5">
                <div className="flex gap-1">
                  {(['keyw', 'domain'] as const).map(t => (
                    <button key={t} onClick={() => setQueryType(t)}
                      className={`px-2 py-1 text-[8px] font-mono font-bold tracking-widest rounded-sm border transition-colors ${
                        queryType === t
                          ? 'border-[#FF3D3D]/60 bg-[#FF3D3D]/10 text-[#FF3D3D]'
                          : 'border-[var(--border-primary)] text-[var(--text-muted)] hover:border-[var(--border-primary)]/60'
                      }`}>
                      {t === 'keyw' ? 'KEYWORD' : 'DOMAIN'}
                    </button>
                  ))}
                </div>
                <select
                  value={dset}
                  onChange={e => setDset(e.target.value)}
                  className="ml-auto bg-transparent border border-[var(--border-primary)] text-[8px] font-mono px-1.5 py-1 rounded-sm focus:outline-none focus:border-[#FF3D3D]/40"
                  style={{ color: DSET_COLORS[dset] }}
                >
                  {Object.entries(DSET_LABELS).map(([k, v]) => (
                    <option key={k} value={k} style={{ background: '#0c0e1a', color: DSET_COLORS[k] }}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                  placeholder={queryType === 'domain' ? 'example.com' : 'company name...'}
                  className="flex-1 bg-black/30 border border-[var(--border-primary)] text-[10px] font-mono text-[var(--text-primary)] px-2.5 py-1.5 rounded-sm placeholder-[var(--text-muted)]/40 focus:outline-none focus:border-[#FF3D3D]/50"
                />
                <button
                  onClick={runSearch}
                  disabled={loading || !query.trim()}
                  className="px-3 py-1.5 border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 text-[#FF3D3D] text-[9px] font-mono font-bold rounded-sm hover:bg-[#FF3D3D]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <div className="w-3 h-3 border border-[#FF3D3D] border-t-transparent rounded-full animate-spin" />
                    : <Search className="w-3 h-3" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--alert-red)]">
                  <AlertTriangle className="w-3 h-3 shrink-0" />{error}
                </div>
              )}

              {searched && !loading && results.length === 0 && !error && (
                <p className="text-[9px] font-mono text-[var(--text-muted)] text-center py-2">No matches found</p>
              )}

              {results.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto styled-scrollbar">
                  {results.map((r, i) => {
                    const color = DSET_COLORS[r.dset || 'ext'] || '#FF3D3D';
                    const label = DSET_LABELS[r.dset || 'ext'] || 'THREAT';
                    return (
                      <div key={i} className="rounded-sm p-2 transition-colors"
                        style={{ border: `1px solid ${color}25`, background: `${color}05` }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] leading-tight">{r.victim || '—'}</span>
                          <span className="text-[7px] font-mono font-bold shrink-0 px-1 py-0.5 rounded-sm"
                            style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
                            {label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px] font-mono">
                          {r.actor && <div><span className="text-[var(--text-muted)]">ACTOR </span><span style={{ color }}>{r.actor}</span></div>}
                          {r.date && <div><span className="text-[var(--text-muted)]">DATE </span><span className="text-[var(--text-secondary)]">{r.date}</span></div>}
                          {r.sector && <div><span className="text-[var(--text-muted)]">SECTOR </span><span className="text-[var(--text-secondary)]">{r.sector}</span></div>}
                          {(r.victimCity || r.country) && (
                            <div><span className="text-[var(--text-muted)]">LOC </span>
                              <span className="text-[var(--text-secondary)]">{[r.victimCity, r.victimCC || r.country].filter(Boolean).join(', ')}</span>
                            </div>
                          )}
                          {r.domain && <div className="col-span-2 truncate"><span className="text-[var(--text-muted)]">DOMAIN </span><span className="text-[var(--cyan-primary)]">{r.domain}</span></div>}
                        </div>
                        {r.annLink && (
                          <a href={r.annLink} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1.5 text-[7px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            <ExternalLink className="w-2.5 h-2.5" />SOURCE
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
