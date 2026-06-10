'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapPin, Plus, X, Search, Trash2, Download, Clock, AlertTriangle, Info, Eye, Siren, BrainCircuit } from 'lucide-react';
import {
  IntelPin, PinSeverity, PinCategory,
  SEVERITY_COLORS, SEVERITY_LABELS, CATEGORY_ICONS,
  loadPins, savePins, generateId, exportPinsGeoJSON
} from '@/lib/intel-pins';

/* ═══════════════════════════════════════════════════════════════
   OSIRIS — Intel Pins Panel
   Drop intel pins on the map, annotate, search, filter, export.
   ═══════════════════════════════════════════════════════════════ */

interface IntelPinsPanelProps {
  pins: IntelPin[];
  setPins: (pins: IntelPin[]) => void;
  onLocate: (lat: number, lng: number) => void;
  pendingPin?: { lat: number; lng: number } | null;
  clearPendingPin?: () => void;
}

const SEVERITY_ICONS: Record<PinSeverity, React.ComponentType<any>> = {
  info: Info,
  watch: Eye,
  alert: AlertTriangle,
  critical: Siren,
};

export default function IntelPinsPanel({
  pins, setPins, onLocate,
  pendingPin, clearPendingPin
}: IntelPinsPanelProps) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<PinSeverity | 'all'>('all');
  // Cluster detection + AI briefing
  const [aiBriefing, setAiBriefing] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [clusterSize, setClusterSize] = useState(0);
  const [showBriefing, setShowBriefing] = useState(false);

  // Haversine distance (km)
  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // Detect largest cluster of pins within 500km radius
  const clusters = useMemo(() => {
    const results: { index: number; count: number; pins: IntelPin[]; centerLat: number; centerLng: number }[] = [];
    for (let i = 0; i < pins.length; i++) {
      const group: IntelPin[] = [pins[i]];
      for (let j = 0; j < pins.length; j++) {
        if (i !== j && haversineKm(pins[i].lat, pins[i].lng, pins[j].lat, pins[j].lng) <= 500) {
          group.push(pins[j]);
        }
      }
      if (group.length >= 5) {
        const avgLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
        const avgLng = group.reduce((s, p) => s + p.lng, 0) / group.length;
        results.push({ index: i, count: group.length, pins: group, centerLat: avgLat, centerLng: avgLng });
      }
    }
    // Remove duplicates — keep the largest group
    results.sort((a, b) => b.count - a.count);
    if (results.length > 0) {
      const best = results[0];
      // Deduplicate: filter out overlapping groups
      const unique = [results[0]];
      for (const r of results.slice(1)) {
        if (!unique.some(u => haversineKm(u.centerLat, u.centerLng, r.centerLat, r.centerLng) < 100)) {
          unique.push(r);
        }
      }
      return unique;
    }
    return [];
  }, [pins]);

  // Keep clusterSize in sync
  useEffect(() => {
    if (clusters.length > 0) {
      setClusterSize(clusters[0].count);
    } else {
      setClusterSize(0);
    }
  }, [clusters]);

  // Generate AI briefing for a cluster
  const generateBriefing = useCallback(async (cluster: typeof clusters[0]) => {
    setAiLoading(true);
    setAiError(null);
    setAiBriefing(null);
    setShowBriefing(true);

    try {
      // Build IntelligenceContext from cluster pins
      const threats = cluster.pins.map(p => ({
        id: p.id,
        type: p.category.toUpperCase(),
        title: p.title,
        description: p.description || 'No description',
        severity: p.severity === 'critical' ? 'CRITICAL' as const : p.severity === 'alert' ? 'HIGH' as const : p.severity === 'watch' ? 'ELEVATED' as const : 'LOW' as const,
        region: `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`,
        latitude: p.lat,
        longitude: p.lng,
        timestamp: new Date(p.createdAt).toISOString(),
        source: 'INTEL PIN',
      }));

      const context = {
        earthquakes: [],
        news: [],
        threats,
        cyberAlerts: [],
        timestamp: new Date().toISOString(),
      };

      const query = `Analyze this intelligence cluster of ${cluster.count} observation pins within a 500km radius. Identify patterns, connections between the observations, threat assessments, and recommend actions. Format your response with markdown headers: CLUSTER OVERVIEW, PATTERNS DETECTED, THREAT ASSESSMENT, and RECOMMENDED ACTIONS. Be specific — reference pin titles and descriptions directly.`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setAiBriefing(data.analysis);
    } catch (e: any) {
      setAiError(e.message || 'Briefing failed');
    } finally {
      setAiLoading(false);
    }
  }, []);
  const [filterCategory, setFilterCategory] = useState<PinCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'severity'>('newest');

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSeverity, setFormSeverity] = useState<PinSeverity>('info');
  const [formCategory, setFormCategory] = useState<PinCategory>('general');
  const [formTags, setFormTags] = useState('');
  const [formLat, setFormLat] = useState<number>(0);
  const [formLng, setFormLng] = useState<number>(0);
  const [formExpiry, setFormExpiry] = useState('never');

  const inputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // When pendingPin arrives from right-click, open form pre-filled
  useEffect(() => {
    if (pendingPin) {
      setFormLat(pendingPin.lat);
      setFormLng(pendingPin.lng);
      setFormTitle('');
      setFormDesc('');
      setFormSeverity('info');
      setFormCategory('general');
      setFormTags('');
      setFormExpiry('never');
      setShowForm(true);
      setOpen(true);
      if (clearPendingPin) clearPendingPin();
    }
  }, [pendingPin, clearPendingPin]);

  useEffect(() => {
    if (open && showForm) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open, showForm]);

  const filteredPins = useMemo(() => {
    let result = [...pins];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        p.linkedEntity?.toLowerCase().includes(q)
      );
    }
    if (filterSeverity !== 'all') result = result.filter(p => p.severity === filterSeverity);
    if (filterCategory !== 'all') result = result.filter(p => p.category === filterCategory);
    if (sortBy === 'newest') result.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === 'oldest') result.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortBy === 'severity') {
      const order: PinSeverity[] = ['critical', 'alert', 'watch', 'info'];
      result.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
    }
    return result;
  }, [pins, search, filterSeverity, filterCategory, sortBy]);

  const handleCreate = useCallback(() => {
    if (!formTitle.trim()) return;
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);
    let expiresAt: number | undefined;
    if (formExpiry !== 'never') {
      const hrs = parseInt(formExpiry);
      if (!isNaN(hrs)) expiresAt = Date.now() + hrs * 3600000;
    }
    const newPin: IntelPin = {
      id: generateId(),
      title: formTitle.trim(),
      description: formDesc.trim(),
      lat: formLat || 0,
      lng: formLng || 0,
      severity: formSeverity,
      category: formCategory,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt,
      tags,
    };
    setPins([newPin, ...pins]);
    setShowForm(false);
    setFormTitle('');
    setFormDesc('');
  }, [formTitle, formDesc, formSeverity, formCategory, formTags, formExpiry, formLat, formLng, pins, setPins]);

  const handleDelete = useCallback((id: string) => {
    setPins(pins.filter(p => p.id !== id));
  }, [pins, setPins]);

  const handleExport = useCallback(() => {
    const geo = exportPinsGeoJSON(pins);
    const blob = new Blob([geo], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `osiris_intel_pins_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pins]);

  const criticalCount = pins.filter(p => p.severity === 'critical' || p.severity === 'alert').length;

  const IconInfo = Info;
  const IconEye = Eye;
  const IconAlert = AlertTriangle;
  const IconSiren = Siren;

  const severityIcon = (s: PinSeverity, className: string) => {
    if (s === 'info') return <Info className={className} />;
    if (s === 'watch') return <Eye className={className} />;
    if (s === 'alert') return <AlertTriangle className={className} />;
    return <Siren className={className} />;
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); setShowForm(false); }}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          open ? 'bg-[var(--gold-primary)]/20' : 'hover:bg-white/10'
        } relative`}
        title="INTEL PINS"
      >
        <MapPin className={`w-4 h-4 ${open ? 'text-[var(--gold-primary)]' : 'text-white/60'}`} />
        {criticalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--alert-red)] animate-osiris-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-80 glass-panel overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] max-h-[75vh] flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-secondary)]">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
              <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] tracking-wider">INTEL PINS</span>
              <span className="text-[8px] text-[var(--text-muted)] font-mono">({pins.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleExport} disabled={pins.length === 0}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--cyan-primary)] transition-colors disabled:opacity-30"
                title="EXPORT GEOJSON">
                <Download className="w-3 h-3" />
              </button>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="px-3 py-2 border-b border-[var(--border-secondary)] bg-[var(--hover-accent)]/50">
              <div className="flex items-center gap-1 mb-2">
                <MapPin className="w-2.5 h-2.5 text-[var(--gold-primary)]" />
                <span className="text-[8px] font-mono text-[var(--gold-primary)] font-bold tracking-wider">NEW INTEL PIN</span>
                <span className="text-[7px] font-mono text-[var(--text-muted)] ml-auto">
                  {(formLat || 0).toFixed(4)}, {(formLng || 0).toFixed(4)}
                </span>
              </div>
              <input ref={inputRef} value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder="TITLE *" maxLength={120}
                className="w-full bg-[var(--bg-void)] text-[9px] font-mono text-[var(--text-primary)] px-2 py-1.5 rounded outline-none border border-[var(--border-secondary)] focus:border-[var(--gold-primary)] mb-1.5 placeholder:text-[var(--text-muted)]" />
              <textarea ref={descRef} value={formDesc} onChange={e => setFormDesc(e.target.value)}
                placeholder="DESCRIPTION (OPTIONAL)" rows={2} maxLength={500}
                className="w-full bg-[var(--bg-void)] text-[8px] font-mono text-[var(--text-secondary)] px-2 py-1.5 rounded outline-none border border-[var(--border-secondary)] focus:border-[var(--gold-primary)] mb-1.5 resize-none placeholder:text-[var(--text-muted)]" />
              <div className="flex gap-1.5 mb-1.5">
                <select value={formSeverity} onChange={e => setFormSeverity(e.target.value as PinSeverity)}
                  className="flex-1 bg-[var(--bg-void)] text-[8px] font-mono text-[var(--text-primary)] px-1.5 py-1 rounded outline-none border border-[var(--border-secondary)]">
                  {(['info','watch','alert','critical'] as PinSeverity[]).map(s => (
                    <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                  ))}
                </select>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value as PinCategory)}
                  className="flex-1 bg-[var(--bg-void)] text-[8px] font-mono text-[var(--text-primary)] px-1.5 py-1 rounded outline-none border border-[var(--border-secondary)]">
                  {(['observation','threat','infrastructure','source','general'] as PinCategory[]).map(c => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1.5 mb-2">
                <input value={formTags} onChange={e => setFormTags(e.target.value)}
                  placeholder="TAGS (comma separated)"
                  className="flex-1 bg-[var(--bg-void)] text-[7px] font-mono text-[var(--text-secondary)] px-2 py-1 rounded outline-none border border-[var(--border-secondary)] placeholder:text-[var(--text-muted)]" />
                <select value={formExpiry} onChange={e => setFormExpiry(e.target.value)}
                  className="w-16 bg-[var(--bg-void)] text-[7px] font-mono text-[var(--text-muted)] px-1 py-1 rounded outline-none border border-[var(--border-secondary)]">
                  <option value="never">∞</option>
                  <option value="1">1H</option>
                  <option value="6">6H</option>
                  <option value="24">24H</option>
                  <option value="168">7D</option>
                </select>
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleCreate}
                  className="flex-1 py-1.5 rounded bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] text-[8px] font-mono font-bold hover:bg-[var(--gold-primary)]/25 transition-colors border border-[var(--gold-primary)]/20">
                  DROP PIN
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 rounded text-[8px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-secondary)] transition-colors">
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* Search + Filter */}
          <div className="px-3 py-1.5 border-b border-[var(--border-secondary)]">
            <div className="flex items-center gap-1.5 mb-1">
              <Search className="w-2.5 h-2.5 text-[var(--text-muted)] flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="SEARCH PINS..."
                className="flex-1 bg-transparent text-[8px] font-mono text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
              {pins.length >= 0 && !showForm && (
                <button onClick={() => { setFormLat(0); setFormLng(0); setShowForm(true); }}
                  className="p-1 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 rounded transition-colors"
                  title="CREATE PIN AT CENTER">
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as PinSeverity | 'all')}
                className="bg-[var(--bg-void)] text-[7px] font-mono text-[var(--text-muted)] px-1 py-0.5 rounded outline-none border border-[var(--border-secondary)] flex-1">
                <option value="all">ALL SEVERITY</option>
                {(['info','watch','alert','critical'] as PinSeverity[]).map(s => (
                  <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                ))}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as PinCategory | 'all')}
                className="bg-[var(--bg-void)] text-[7px] font-mono text-[var(--text-muted)] px-1 py-0.5 rounded outline-none border border-[var(--border-secondary)] flex-1">
                <option value="all">ALL CATEGORY</option>
                {(['observation','threat','infrastructure','source','general'] as PinCategory[]).map(c => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                className="bg-[var(--bg-void)] text-[7px] font-mono text-[var(--text-muted)] px-1 py-0.5 rounded outline-none border border-[var(--border-secondary)] flex-shrink-0">
                <option value="newest">NEW</option>
                <option value="oldest">OLD</option>
                <option value="severity">SEV</option>
              </select>
            </div>
          </div>

          {/* Pins List */}
          <div className="flex-1 overflow-y-auto styled-scrollbar" style={{ maxHeight: '350px' }}>
            {filteredPins.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">
                  {pins.length === 0 ? 'NO INTEL PINS' : 'NO MATCHES'}
                </span>
                <p className="text-[7px] font-mono text-[var(--text-muted)]/50 mt-1">
                  {pins.length === 0 ? 'RIGHT-CLICK ON THE MAP TO DROP A PIN' : 'TRY A DIFFERENT SEARCH OR FILTER'}
                </p>
              </div>
            ) : (
              filteredPins.map(pin => (
                <div key={pin.id}
                  className="flex items-start gap-2 px-3 py-2 border-b border-[var(--border-secondary)]/50 last:border-0 hover:bg-[var(--hover-accent)] transition-colors cursor-pointer"
                  onClick={() => onLocate(pin.lat, pin.lng)}
                >
                  <div className="mt-0.5 flex-shrink-0" style={{ color: SEVERITY_COLORS[pin.severity] }}>
                    {severityIcon(pin.severity, 'w-3 h-3')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono font-bold text-[var(--text-primary)] truncate">
                        {pin.title}
                      </span>
                      <span className="text-[7px] font-mono text-[var(--text-muted)] flex-shrink-0">{CATEGORY_ICONS[pin.category]}</span>
                    </div>
                    {pin.description && (
                      <p className="text-[7px] font-mono text-[var(--text-secondary)] leading-relaxed mt-0.5 line-clamp-2">
                        {pin.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[6px] font-mono text-[var(--text-muted)]">
                        {new Date(pin.createdAt).toLocaleDateString()} {new Date(pin.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                      </span>
                      <span className="text-[6px] font-mono text-[var(--text-muted)]">
                        {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
                      </span>
                      {pin.expiresAt && (
                        <span className="text-[6px] font-mono text-[var(--alert-red)]/70 flex items-center gap-0.5">
                          <Clock className="w-2 h-2" />
                          {Math.ceil((pin.expiresAt - Date.now()) / 3600000)}H
                        </span>
                      )}
                      {pin.tags.map(t => (
                        <span key={t} className="text-[6px] font-mono px-1 py-0.5 rounded bg-[var(--bg-void)] text-[var(--text-muted)]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(pin.id); }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--alert-red)] transition-colors flex-shrink-0 opacity-0 hover:opacity-100">
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cluster Briefing */}
          {clusters.length > 0 && (
            <div className="border-t border-[var(--border-secondary)]">
              <button
                onClick={() => { if (!showBriefing) generateBriefing(clusters[0]); else setShowBriefing(!showBriefing); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hover-accent)] transition-colors"
              >
                <BrainCircuit className="w-3 h-3 text-[var(--cyan-primary)]" />
                <span className="text-[8px] font-mono font-bold text-[var(--cyan-primary)] tracking-wider">
                  AI BRIEF — {clusters[0].count} PINS IN CLUSTER
                </span>
                <span className="ml-auto text-[7px] text-[var(--text-muted)]">{showBriefing ? '▲' : '▼'}</span>
              </button>

              {showBriefing && (
                <div className="px-3 pb-2">
                  {aiLoading ? (
                    <div className="flex items-center gap-2 py-3">
                      <div className="w-3 h-3 border border-[var(--cyan-primary)] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[7px] font-mono text-[var(--text-muted)]">ANALYZING CLUSTER PATTERNS...</span>
                    </div>
                  ) : aiError ? (
                    <div className="py-2">
                      <span className="text-[7px] font-mono text-[var(--alert-red)]">BRIEFING FAILED: {aiError}</span>
                      <p className="text-[6px] font-mono text-[var(--text-muted)] mt-1">Set GEMINI_API_KEY_1 in .env or add x-gemini-key header.</p>
                    </div>
                  ) : aiBriefing ? (
                    <div className="py-2 max-h-[250px] overflow-y-auto styled-scrollbar">
                      <div className="text-[7px] font-mono text-[var(--text-secondary)] leading-relaxed briefing-content whitespace-pre-wrap">
                        {aiBriefing.split('\n').map((line, i) => {
                          if (line.startsWith('#')) {
                            const level = line.match(/^#+/)?.[0].length || 1;
                            const text = line.replace(/^#+\s*/, '');
                            const sizes = ['text-[9px] font-bold mt-2 mb-1', 'text-[8px] font-bold mt-1.5 mb-0.5', 'text-[8px] font-semibold mt-1 mb-0.5'];
                            const colors = ['text-[var(--gold-primary)]', 'text-[var(--cyan-primary)]', 'text-[var(--text-primary)]'];
                            return <p key={i} className={`${sizes[Math.min(level-1, 2)]} ${colors[Math.min(level-1, 2)]}`}>{text}</p>;
                          }
                          if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
                            return <p key={i} className="pl-3 text-[7px] text-[var(--text-secondary)] my-0.5">{line}</p>;
                          }
                          if (line.trim() === '') return <div key={i} className="h-1" />;
                          return <p key={i} className="text-[7px] text-[var(--text-secondary)] my-0.5">{line}</p>;
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-[var(--border-secondary)] bg-[var(--bg-void)]/50">
            <span className="text-[6px] font-mono text-[var(--text-muted)]/60 tracking-wider">
              RIGHT-CLICK MAP → DROP INTEL PIN · {pins.length} TOTAL · {criticalCount} CRITICAL
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
