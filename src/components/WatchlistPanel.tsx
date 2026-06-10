'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Crosshair, Plus, X, MapPin, Trash2, Bell, BellOff } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   OSIRIS — Watchlist / Hotlist Panel
   Track entities across all live feeds. When a watched callsign,
   tail number, MMSI, IMO, IP, or crypto address appears in any
   feed, auto-fly to it and show a match alert.
   Data persisted in localStorage — survives page reloads.
   ═══════════════════════════════════════════════════════════════ */

interface WatchItem {
  id: string;        // normalized search term
  label: string;     // what the user typed
  addedAt: number;
  lastMatch?: number;
}

interface WatchlistPanelProps {
  data: Record<string, any[]>;
  onLocate: (lat: number, lng: number) => void;
  onMatch?: (label: string) => void; // optional callback for alert sounds etc
}

const STORAGE_KEY = 'osiris_watchlist';

function loadWatchlist(): WatchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveWatchlist(items: WatchItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/** Extract searchable fields from any entity object */
function entitySearchableFields(entity: any): string[] {
  const fields: string[] = [];
  const obj = entity?.properties || entity;
  if (!obj) return fields;

  const candidates = [
    obj.callsign, obj.icao24, obj.registration, obj.flight,
    obj.tail_number, obj.tail, obj.name,
    obj.mmsi?.toString(), obj.imo?.toString(),
    obj.ip, obj.hostname, obj.domain,
    obj.wallet, obj.address,
    obj.vessel_name, obj.ship_name,
    obj.destination, obj.origin,
    obj.airport, obj.route,
    // Also check the raw entity
    entity.callsign, entity.icao24, entity.flight,
    entity.mmsi?.toString(), entity.imo?.toString(),
    entity.ip, entity.name,
  ];

  for (const f of candidates) {
    if (f && typeof f === 'string') fields.push(f);
  }
  return fields;
}

export default function WatchlistPanel({ data, onLocate, onMatch }: WatchlistPanelProps) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<{ label: string; lat: number; lng: number; feed: string }[]>([]);
  const [enabled, setEnabled] = useState(true);
  const notifiedRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setItems(loadWatchlist());
  }, []);

  // Persist whenever items change
  useEffect(() => {
    saveWatchlist(items);
  }, [items]);

  // Scan all data feeds for watched items
  useEffect(() => {
    if (!enabled || items.length === 0) return;

    const newMatches: typeof matches = [];
    const matchedIds = new Set<string>();

    // Helper: check a value against all watch items
    const checkValue = (val: unknown, feed: string, lat: number, lng: number) => {
      if (!val || typeof val !== 'string') return;
      const nv = normalize(val);
      for (const item of items) {
        const ni = normalize(item.id);
        if (nv.includes(ni) || ni.includes(nv)) {
          const key = `${item.id}:${nv}`;
          if (!matchedIds.has(key)) {
            matchedIds.add(key);
            newMatches.push({ label: item.label, lat, lng, feed });
          }
        }
      }
    };

    // Scan all array feeds in data
    for (const [feedKey, feedData] of Object.entries(data)) {
      if (!Array.isArray(feedData)) continue;
      for (const entity of feedData) {
        const lat = entity.lat ?? entity.latitude ?? entity.geometry?.coordinates?.[1];
        const lng = entity.lng ?? entity.longitude ?? entity.geometry?.coordinates?.[0];
        if (lat == null || lng == null) continue;

        const fields = entitySearchableFields(entity);

        // Also check top-level string fields
        for (const [k, v] of Object.entries(entity)) {
          if (typeof v === 'string' && k !== 'type' && k !== 'source') {
            fields.push(v);
          }
        }

        for (const f of fields) {
          checkValue(f, feedKey, Number(lat), Number(lng));
        }
      }
    }

    if (newMatches.length > 0) {
      setMatches(prev => {
        const combined = [...newMatches, ...prev];
        // Keep last 20
        return combined.slice(0, 20);
      });

      // Auto-fly to the first new match
      const first = newMatches[0];
      if (first && onLocate) {
        onLocate(first.lat, first.lng);
      }

      // Update lastMatch timestamp
      const matchedLabels = new Set(newMatches.map(m => m.label));
      setItems(prev =>
        prev.map(item =>
          matchedLabels.has(item.label)
            ? { ...item, lastMatch: Date.now() }
            : item
        )
      );

      // Fire onMatch callback (for alert sounds etc)
      if (onMatch) {
        for (const m of newMatches) {
          const notifyKey = `${m.label}:${Math.floor(m.lat * 10)}:${Math.floor(m.lng * 10)}`;
          if (!notifiedRef.current.has(notifyKey)) {
            notifiedRef.current.add(notifyKey);
            onMatch(m.label);
          }
        }
      }
    }
  }, [data, items, enabled, onLocate, onMatch]);

  // Close panel on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const addItem = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const norm = normalize(trimmed);
    if (!norm) return;
    if (items.some(i => normalize(i.id) === norm)) return;
    setItems(prev => [{ id: trimmed, label: trimmed, addedAt: Date.now() }, ...prev]);
    setInput('');
  }, [input, items]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    // Clear notifications for this item
    notifiedRef.current = new Set(
      Array.from(notifiedRef.current).filter(k => !k.startsWith(id))
    );
  }, []);

  const clearMatches = useCallback(() => {
    setMatches([]);
    notifiedRef.current.clear();
  }, []);

  // ── RENDER ──

  const matchCount = items.filter(i => i.lastMatch).length;

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          open ? 'bg-[var(--gold-primary)]/20' : 'hover:bg-white/10'
        } relative`}
        title="WATCHLIST"
      >
        <Crosshair className={`w-4 h-4 ${open ? 'text-[var(--gold-primary)]' : 'text-white/60'}`} />
        {matchCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--alert-red)] animate-osiris-pulse" />
        )}
      </button>

      {/* Panel Slideout */}
      {open && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-80 glass-panel overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-secondary)]">
            <div className="flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
              <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] tracking-wider">WATCHLIST</span>
              <span className="text-[8px] text-[var(--text-muted)] font-mono">({items.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEnabled(!enabled)}
                className={`p-1 rounded transition-colors ${enabled ? 'text-[var(--alert-green)]' : 'text-[var(--text-muted)]'}`}
                title={enabled ? 'DISABLE WATCHING' : 'ENABLE WATCHING'}
              >
                {enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              </button>
              <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Add Input */}
          <div className="px-3 py-2 border-b border-[var(--border-secondary)]">
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                placeholder="CALLSIGN / TAIL / MMSI / IP..."
                className="flex-1 bg-[var(--bg-void)] text-[9px] font-mono text-[var(--text-primary)] px-2 py-1.5 rounded outline-none border border-[var(--border-secondary)] focus:border-[var(--gold-primary)] placeholder:text-[var(--text-muted)]"
              />
              <button
                onClick={addItem}
                className="p-1.5 rounded bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="mt-1 text-[6px] text-[var(--text-muted)] font-mono tracking-wider">
              TRACKS: FLIGHTS · SHIPS · SATELLITES · CCTV · IP REP · CRYPTO · CVES
            </div>
          </div>

          {/* Watchlist Items */}
          <div className="flex-1 overflow-y-auto styled-scrollbar" style={{ maxHeight: '200px' }}>
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">NO WATCHED ENTITIES</span>
                <p className="text-[7px] font-mono text-[var(--text-muted)]/50 mt-1">ADD A CALLSIGN, TAIL NUMBER, MMSI, OR IP ABOVE</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-[var(--border-secondary)]/50 last:border-0 hover:bg-[var(--hover-accent)] transition-colors ${
                    item.lastMatch ? 'bg-[var(--gold-primary)]/5' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] truncate">
                        {item.label}
                      </span>
                      {item.lastMatch && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--alert-green)] animate-osiris-pulse flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[7px] font-mono text-[var(--text-muted)]">
                        ADDED {new Date(item.addedAt).toLocaleDateString()}
                      </span>
                      {item.lastMatch && (
                        <span className="text-[7px] font-mono text-[var(--alert-green)]">
                          MATCH {Math.floor((Date.now() - item.lastMatch) / 1000)}s ago
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--alert-red)] transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Recent Matches */}
          {matches.length > 0 && (
            <div className="border-t border-[var(--border-secondary)]">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-wider">
                  RECENT MATCHES ({matches.length})
                </span>
                <button onClick={clearMatches} className="text-[7px] font-mono text-[var(--text-muted)] hover:text-[var(--alert-red)]">
                  CLEAR
                </button>
              </div>
              <div className="max-h-[120px] overflow-y-auto styled-scrollbar">
                {matches.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => onLocate(m.lat, m.lng)}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--hover-accent)] transition-colors border-b border-[var(--border-secondary)]/30 last:border-0"
                  >
                    <MapPin className="w-2.5 h-2.5 text-[var(--gold-primary)] flex-shrink-0" />
                    <span className="text-[8px] font-mono text-[var(--text-primary)] truncate flex-1">{m.label}</span>
                    <span className="text-[6px] font-mono text-[var(--text-muted)] flex-shrink-0">{m.feed}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
