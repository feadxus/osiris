'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronUp, BarChart3,
  Zap, Shield, Droplets, Gem, Bitcoin, LineChart, Maximize2, Minimize2,
  Globe2, AlertTriangle, Bug, CloudLightning, Building2, Wind
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type MarketTicker = {
  price?: number;
  up?: boolean;
  change_percent?: number;
};

type MarketsData = Record<string, Record<string, MarketTicker> | string[] | undefined> & {
  scm_alerts?: string[];
};

type SpaceWeather = {
  storm_color?: string;
  kp_index?: number;
  storm_level?: string;
  solar_flares?: Array<{ class?: string }>;
};

type CyberPriorityItem = {
  id?: string;
  priority?: string;
};

type DisasterEvent = {
  id?: string;
  title?: string;
  type?: string;
};

type UrlhausIndicator = {
  id?: string | number;
  host?: string;
  url?: string;
  threat?: string;
};

type DashboardData = {
  markets?: MarketsData;
  cyber_priority_stats?: { critical?: number; total?: number };
  cyber_priorities?: CyberPriorityItem[];
  disaster_events?: DisasterEvent[];
  urlhaus_indicators?: UrlhausIndicator[];
  infrastructure_context?: unknown[];
  local_forecast?: { risk?: { level?: string } };
  air_quality_source?: { status?: string };
  air_quality_stations?: unknown[];
};

interface MarketsPanelProps { data: DashboardData; spaceWeather?: SpaceWeather | null; }

const SECTIONS = [
  { key: 'public', label: 'PUBLIC', icon: Globe2 },
  { key: 'indices', label: 'INDICES', icon: LineChart },
  { key: 'stocks', label: 'DEFENSE', icon: Shield },
  { key: 'oil', label: 'ENERGY', icon: Droplets },
  { key: 'commodities', label: 'COMMODITIES', icon: Gem },
  { key: 'crypto', label: 'CRYPTO', icon: Bitcoin },
];

function Ticker({ name, data: d }: { name: string; data: MarketTicker }) {
  if (!d) return null;
  const price = d.price ?? 0;
  const changePercent = d.change_percent ?? 0;
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--hover-accent)] transition-colors">
      <span className="text-[10px] font-mono text-[var(--text-secondary)] tracking-wide">{name}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] tabular-nums">
          {price >= 1000 ? `${(price / 1000).toFixed(1)}K` : price.toFixed(2)}
        </span>
        <span className={`text-[9px] font-mono font-bold flex items-center gap-0.5 ${d.up ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
          {d.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

const severityClass: Record<string, string> = {
  critical: 'text-[var(--alert-red)] border-[var(--alert-red)]/30 bg-[var(--alert-red)]/10',
  high: 'text-[#FF9500] border-[#FF9500]/30 bg-[#FF9500]/10',
  medium: 'text-[#FFD54F] border-[#FFD54F]/30 bg-[#FFD54F]/10',
  low: 'text-[var(--alert-green)] border-[var(--alert-green)]/30 bg-[var(--alert-green)]/10',
  disabled: 'text-[var(--text-muted)] border-white/10 bg-white/5',
};

function PublicStat({
  icon: Icon,
  label,
  value,
  tone = 'low',
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className={`rounded-lg border px-2 py-2 ${severityClass[tone] || severityClass.low}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 flex-shrink-0" />
        <span className="text-[8px] font-mono tracking-widest text-[var(--text-muted)] uppercase truncate">{label}</span>
      </div>
      <div className="mt-1 text-[13px] font-mono font-bold tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function PublicIntelSection({ data }: { data: DashboardData }) {
  const cyberStats = data.cyber_priority_stats || {};
  const cyberPriorities = Array.isArray(data.cyber_priorities) ? data.cyber_priorities : [];
  const disasters = Array.isArray(data.disaster_events) ? data.disaster_events : [];
  const urlhaus = Array.isArray(data.urlhaus_indicators) ? data.urlhaus_indicators : [];
  const infra = Array.isArray(data.infrastructure_context) ? data.infrastructure_context : [];
  const forecast = data.local_forecast;
  const airQualityStatus = data.air_quality_source?.status || 'disabled';
  const forecastRisk = forecast?.risk?.level || 'pending';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <PublicStat icon={Bug} label="Cyber priority" value={`${cyberStats.critical || 0}/${cyberStats.total || 0}`} tone={(cyberStats.critical || 0) > 0 ? 'critical' : 'low'} />
        <PublicStat icon={AlertTriangle} label="Disasters" value={disasters.length} tone={disasters.length > 0 ? 'high' : 'low'} />
        <PublicStat icon={CloudLightning} label="Forecast risk" value={forecastRisk.toUpperCase()} tone={forecastRisk} />
        <PublicStat icon={Building2} label="Infra context" value={infra.length} tone={infra.length > 0 ? 'medium' : 'disabled'} />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)]">TOP CVE PRIORITY</span>
          <span className="text-[8px] font-mono text-[var(--text-muted)]">EPSS / KEV</span>
        </div>
        <div className="space-y-1">
          {cyberPriorities.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-[9px] font-mono">
              <span className="truncate text-[var(--text-secondary)]">{item.id}</span>
              <span className={`rounded border px-1.5 py-0.5 uppercase ${severityClass[item.priority || 'low'] || severityClass.low}`}>{item.priority || 'low'}</span>
            </div>
          ))}
          {cyberPriorities.length === 0 && <div className="py-2 text-center text-[9px] font-mono text-[var(--text-muted)]">Loading cyber priorities...</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[9px] font-mono tracking-widest text-[var(--text-muted)]">
            <Globe2 className="w-3 h-3" />
            GDACS
          </div>
          <div className="space-y-1">
            {disasters.slice(0, 2).map((event) => (
              <div key={event.id || event.title} className="truncate text-[9px] font-mono text-[var(--text-secondary)]">{event.title || event.type}</div>
            ))}
            {disasters.length === 0 && <div className="text-[9px] font-mono text-[var(--text-muted)]">No active events</div>}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <div className="mb-1 flex items-center gap-1.5 text-[9px] font-mono tracking-widest text-[var(--text-muted)]">
            <Wind className="w-3 h-3" />
            OPENAQ
          </div>
          <div className="text-[9px] font-mono text-[var(--text-secondary)]">
            {data.air_quality_stations?.length || 0} stations
            <span className="ml-1 text-[var(--text-muted)]">({airQualityStatus})</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)]">URLHAUS RECENT</span>
          <span className="text-[8px] font-mono text-[var(--text-muted)]">{urlhaus.length} indicators</span>
        </div>
        <div className="space-y-1">
          {urlhaus.slice(0, 3).map((indicator) => (
            <div key={indicator.id || indicator.url} className="flex items-center justify-between gap-2 text-[9px] font-mono">
              <span className="truncate text-[var(--text-secondary)]">{indicator.host || indicator.url}</span>
              <span className="text-[var(--text-muted)] uppercase">{indicator.threat || 'malware'}</span>
            </div>
          ))}
          {urlhaus.length === 0 && <div className="py-2 text-center text-[9px] font-mono text-[var(--text-muted)]">Loading malware indicators...</div>}
        </div>
      </div>
    </div>
  );
}

export default function MarketsPanel({ data, spaceWeather }: MarketsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [activeSection, setActiveSection] = useState('public');
  const markets = data.markets || {};
  const latestFlare = spaceWeather?.solar_flares?.[0];

  const content = (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, duration: 0.6 }} className={`glass-panel p-3 pointer-events-auto transition-all duration-300 flex flex-col ${maximized ? 'fixed inset-4 z-[9999] bg-[#0a0a09]/95 backdrop-blur-3xl' : ''}`}>
      <div className="flex items-center justify-between w-full mb-2">
        <button aria-label={expanded ? "Collapse markets and intel panel" : "Expand markets and intel panel"} onClick={() => setExpanded(!expanded)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <BarChart3 className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          <span className="hud-text text-[12px] text-[var(--text-primary)]">MARKETS & INTEL</span>
          <span className="gotham-tag gotham-tag--low" style={{ fontSize: '7px', padding: '1px 4px' }}>LIVE</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--alert-green)] animate-osiris-pulse" />
          <button aria-label={maximized ? "Restore markets and intel panel" : "Maximize markets and intel panel"} onClick={(e) => { e.stopPropagation(); setMaximized(!maximized); if (!expanded && !maximized) setExpanded(true); }} className="hover:text-white transition-colors" title={maximized ? "Restore" : "Maximize"}>
            {maximized ? <Minimize2 className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <Maximize2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>
          <button aria-label={expanded ? "Collapse markets and intel panel" : "Expand markets and intel panel"} onClick={() => setExpanded(!expanded)} className="hover:text-white transition-colors" title={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            {/* Space Weather Banner */}
            {spaceWeather && (
              <div className="mb-2 p-2 rounded-lg border" style={{ borderColor: `${spaceWeather.storm_color}33`, background: `${spaceWeather.storm_color}08` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3" style={{ color: spaceWeather.storm_color }} />
                    <span className="text-[10px] font-mono tracking-widest text-[var(--text-muted)]">SPACE WEATHER</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold" style={{ color: spaceWeather.storm_color }}>
                    Kp {spaceWeather.kp_index} — {spaceWeather.storm_level}
                  </span>
                </div>
                {latestFlare && (
                  <div className="mt-1 text-[8px] font-mono text-[var(--text-muted)]">
                    Latest flare: {latestFlare.class}
                  </div>
                )}
              </div>
            )}

            {/* Section Tabs — icons instead of emojis */}
            <div className="flex gap-0.5 mb-2 overflow-x-auto">
              {SECTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.key} aria-label={`Show ${s.label.toLowerCase()} intelligence`} onClick={() => setActiveSection(s.key)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[9px] font-mono tracking-wider whitespace-nowrap transition-all ${activeSection === s.key ? 'bg-[var(--hover-accent)] text-[var(--gold-primary)] border border-[var(--border-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'}`}>
                    <Icon className="w-3 h-3" />
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* SCM Alerts from Markets API */}
            {markets.scm_alerts && markets.scm_alerts.length > 0 && (
              <div className="mb-2 space-y-1">
                {markets.scm_alerts.map((alert: string, i: number) => (
                  <div key={i} className="px-2 py-1.5 rounded border border-[#FF9500] bg-[#FF9500]/10 text-[#FF9500] text-[9px] font-mono leading-tight shadow-[0_0_8px_rgba(255,149,0,0.15)]">
                    {alert}
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'public' ? (
              <PublicIntelSection data={data} />
            ) : (
              <div className="space-y-0.5 overflow-y-auto styled-scrollbar mt-2">
                {isTickerSection(markets[activeSection]) && Object.entries(markets[activeSection]).map(([name, d]) => (
                  <Ticker key={name} name={name} data={d} />
                ))}
                {(!isTickerSection(markets[activeSection]) || Object.keys(markets[activeSection]).length === 0) && (
                  <div className="text-center py-3 text-[10px] font-mono text-[var(--text-muted)]">Loading {activeSection}...</div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (maximized && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}

function isTickerSection(value: MarketsData[string]): value is Record<string, MarketTicker> {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}
