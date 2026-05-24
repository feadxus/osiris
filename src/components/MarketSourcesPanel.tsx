'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Filter,
  MapPin,
  Pill,
  Scale,
  ShieldAlert,
  Store,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { MarketResearchSource, MarketSourceCategory } from '@/lib/market-research-source-types';
import { marketSourceCategoryColors, marketSourceCategoryLabels } from '@/lib/market-research-sources';

const CATEGORY_ICONS: Record<MarketSourceCategory, typeof Database> = {
  backbone: Database,
  cpg_retail: Store,
  pharma_health: Pill,
  finance_macro: BarChart3,
  policy_regulation: Scale,
  live_risk: ShieldAlert,
};

const CATEGORY_SHORT_LABELS: Record<MarketSourceCategory, string> = {
  backbone: 'BACKBONE',
  cpg_retail: 'CPG',
  pharma_health: 'PHARMA',
  finance_macro: 'FINANCE',
  policy_regulation: 'POLICY',
  live_risk: 'RISK',
};

const ACCESS_LABELS = ['all', 'open', 'freemium', 'commercial', 'restricted'] as const;
const CADENCE_GROUPS = ['all', 'live', 'daily', 'slow'] as const;

type AccessFilter = typeof ACCESS_LABELS[number];
type CadenceFilter = typeof CADENCE_GROUPS[number];

interface MarketSourcesPanelProps {
  sources: readonly MarketResearchSource[];
  isLayerActive: boolean;
  onToggleLayer: () => void;
  onLocate: (lat: number, lng: number) => void;
}

function formatCadence(value: string) {
  return value.replace(/_/g, ' ').toUpperCase();
}

function cadenceMatches(source: MarketResearchSource, filter: CadenceFilter) {
  if (filter === 'all') return true;
  if (filter === 'live') return source.cadence === 'real_time' || source.cadence === 'minutes';
  if (filter === 'daily') return source.cadence === 'daily' || source.cadence === 'weekly';
  return ['monthly', 'quarterly', 'annual', 'release_calendar'].includes(source.cadence);
}

function SourceRow({ source, onLocate }: { source: MarketResearchSource; onLocate: (lat: number, lng: number) => void }) {
  const color = marketSourceCategoryColors[source.category];
  return (
    <div className="rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-2 hover:bg-white/[0.035] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}70` }} />
            <h3 className="text-[11px] font-mono font-bold tracking-wide text-[var(--text-primary)] truncate">{source.name}</h3>
          </div>
          <div className="mt-1 text-[8px] font-mono tracking-[0.16em] text-[var(--text-muted)] uppercase truncate">
            {source.provider} / {source.coverage.replace('_', ' ')}
          </div>
        </div>
        <span
          className="shrink-0 rounded border px-1.5 py-0.5 text-[7px] font-mono font-bold tracking-[0.14em] uppercase"
          style={{ color, borderColor: `${color}66`, background: `${color}14` }}
        >
          P{source.scores.integrationPriority}
        </span>
      </div>

      <p className="mt-2 text-[9px] leading-relaxed text-[var(--text-secondary)]">{source.summary}</p>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <div>
          <div className="hud-label" style={{ fontSize: '6px' }}>ACCESS</div>
          <div className="text-[8px] font-mono font-bold uppercase" style={{ color }}>{source.access}</div>
        </div>
        <div>
          <div className="hud-label" style={{ fontSize: '6px' }}>CADENCE</div>
          <div className="text-[8px] font-mono font-bold text-[var(--text-primary)]">{formatCadence(source.cadence)}</div>
        </div>
        <div>
          <div className="hud-label" style={{ fontSize: '6px' }}>GIS</div>
          <div className="text-[8px] font-mono font-bold text-[var(--text-primary)]">{source.gisMode.replace('_', ' ').toUpperCase()}</div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={() => onLocate(source.location.lat, source.location.lng)}
          className="inline-flex items-center gap-1 rounded border border-[var(--border-primary)] bg-white/[0.03] px-2 py-1 text-[8px] font-mono font-bold tracking-[0.12em] text-[var(--gold-primary)] hover:border-[var(--gold-primary)]/50 transition-colors"
        >
          <MapPin className="w-3 h-3" />
          LOCATE
        </button>
        <a
          href={source.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded border border-[var(--border-secondary)] bg-white/[0.02] px-2 py-1 text-[8px] font-mono font-bold tracking-[0.12em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          DOCS
        </a>
        <span className="ml-auto text-[7px] font-mono text-[var(--text-muted)] truncate">{source.location.label}</span>
      </div>
    </div>
  );
}

export default function MarketSourcesPanel({ sources, isLayerActive, onToggleLayer, onLocate }: MarketSourcesPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MarketSourceCategory>('backbone');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>('all');

  const categoryCounts = useMemo(() => sources.reduce<Record<MarketSourceCategory, number>>((counts, source) => {
    counts[source.category] += 1;
    return counts;
  }, {
    backbone: 0,
    cpg_retail: 0,
    pharma_health: 0,
    finance_macro: 0,
    policy_regulation: 0,
    live_risk: 0,
  }), [sources]);

  const filteredSources = useMemo(() => sources
    .filter(source => source.category === activeCategory)
    .filter(source => accessFilter === 'all' || source.access === accessFilter)
    .filter(source => cadenceMatches(source, cadenceFilter))
    .sort((a, b) => b.scores.integrationPriority - a.scores.integrationPriority || a.name.localeCompare(b.name)), [activeCategory, accessFilter, cadenceFilter, sources]);

  const activeColor = marketSourceCategoryColors[activeCategory];
  const CategoryIcon = CATEGORY_ICONS[activeCategory];

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7, duration: 0.6 }} className="glass-panel p-3 pointer-events-auto">
      <div className="flex items-center justify-between gap-2 mb-2">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 min-w-0 flex-1">
          <div className="relative">
            <Building2 className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${isLayerActive ? 'bg-[var(--alert-green)]' : 'bg-[var(--text-muted)]'}`} />
          </div>
          <span className="hud-text text-[12px] text-[var(--text-primary)] truncate">MARKET SOURCES</span>
          <span className="gotham-tag gotham-tag--info" style={{ fontSize: '7px', padding: '1px 4px' }}>{sources.length}</span>
          {expanded ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" /> : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />}
        </button>
        <button
          onClick={onToggleLayer}
          className="flex items-center gap-1 rounded border border-[var(--border-primary)] bg-white/[0.03] px-2 py-1 text-[8px] font-mono font-bold tracking-[0.12em] text-[var(--text-secondary)] hover:text-[var(--gold-primary)] transition-colors"
          title={isLayerActive ? 'Hide market source markers' : 'Show market source markers'}
        >
          {isLayerActive ? <ToggleRight className="w-3.5 h-3.5 text-[var(--alert-green)]" /> : <ToggleLeft className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          MAP
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="mb-2 rounded-md border border-white/[0.05] bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: activeColor }} />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono font-bold tracking-[0.16em] text-[var(--text-primary)] truncate">{marketSourceCategoryLabels[activeCategory]}</div>
                    <div className="text-[7px] font-mono tracking-[0.18em] text-[var(--text-muted)] uppercase">{filteredSources.length} visible / {categoryCounts[activeCategory]} indexed</div>
                  </div>
                </div>
                <div className="text-[18px] font-mono font-bold tabular-nums" style={{ color: activeColor }}>{categoryCounts[activeCategory]}</div>
              </div>
            </div>

            <div className="flex gap-0.5 mb-2 overflow-x-auto styled-scrollbar">
              {Object.keys(marketSourceCategoryLabels).map(category => {
                const key = category as MarketSourceCategory;
                const Icon = CATEGORY_ICONS[key];
                const color = marketSourceCategoryColors[key];
                const active = activeCategory === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded text-[8px] font-mono tracking-wider whitespace-nowrap transition-all border ${active ? 'bg-white/[0.05]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border-transparent'}`}
                    style={{ color: active ? color : undefined, borderColor: active ? `${color}66` : undefined }}
                  >
                    <Icon className="w-3 h-3" />
                    {CATEGORY_SHORT_LABELS[key]}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className="flex items-center gap-1 overflow-x-auto styled-scrollbar">
                <Filter className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
                {ACCESS_LABELS.map(access => (
                  <button
                    key={access}
                    onClick={() => setAccessFilter(access)}
                    className={`rounded px-1.5 py-1 text-[7px] font-mono font-bold uppercase tracking-[0.12em] border transition-colors ${accessFilter === access ? 'text-[var(--gold-primary)] border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10' : 'text-[var(--text-muted)] border-transparent bg-white/[0.02]'}`}
                  >
                    {access}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-end gap-1 overflow-x-auto styled-scrollbar">
                {CADENCE_GROUPS.map(cadence => (
                  <button
                    key={cadence}
                    onClick={() => setCadenceFilter(cadence)}
                    className={`rounded px-1.5 py-1 text-[7px] font-mono font-bold uppercase tracking-[0.12em] border transition-colors ${cadenceFilter === cadence ? 'text-[var(--cyan-primary)] border-[var(--cyan-primary)]/40 bg-[var(--cyan-primary)]/10' : 'text-[var(--text-muted)] border-transparent bg-white/[0.02]'}`}
                  >
                    {cadence}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 max-h-[260px] overflow-y-auto styled-scrollbar pr-1">
              {filteredSources.length > 0 ? (
                filteredSources.map(source => <SourceRow key={source.id} source={source} onLocate={onLocate} />)
              ) : (
                <div className="text-center py-5 text-[10px] font-mono text-[var(--text-muted)]">No sources match filters.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
