'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Satellite, Activity, Sun, AlertTriangle, Camera, Flame, Target,
  CloudLightning, Radiation, Tv, Anchor, Ship, Newspaper,
  Network, Share2, Radio, Mountain
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
  isMobile?: boolean;
  theme?: 'core' | 'ghost';
  setTheme?: (theme: 'core' | 'ghost') => void;
}

const getLayerGroups = (t: (key: string) => string, theme: 'core' | 'ghost') => {
  const isGhost = theme === 'ghost';
  const phantomPurple = '#B388FF';
  const ghostPriv = '#CE93D8';
  const ghostGov = '#D500F9';

  const flightCom = isGhost ? phantomPurple : '#00E5FF';
  const flightPriv = isGhost ? ghostPriv : '#FFD700';
  const flightGov = isGhost ? ghostGov : '#FF9500';
  const flightMil = '#FF0000';

  return [
  {
    label: t('layerPanel.groups.sdk'),
    fullLabel: t('layerPanel.groups.sdkFull'),
    color: '#1565C0',
    layers: [
      { key: 'sdk_sea', label: t('layerPanel.layers.maritimeLines'), icon: Anchor, color: '#4FC3F7', dataKey: 'sdk_entities' },
      { key: 'sdk_ransomware', label: t('layerPanel.layers.ransomwareFeed'), icon: AlertTriangle, color: '#D32F2F', dataKey: 'sdk_entities' },
    ],
  },
  {
    label: t('layerPanel.groups.aviation'),
    fullLabel: t('layerPanel.groups.aviation'),
    color: flightCom,
    layers: [
      { key: 'flights', label: t('layerPanel.layers.commercial'), icon: Plane, color: flightCom, dataKey: 'commercial_flights' },
      { key: 'private', label: t('layerPanel.layers.private'), icon: Plane, color: flightPriv, dataKey: 'private_flights' },
      { key: 'jets', label: t('layerPanel.layers.privateJets'), icon: Plane, color: flightGov, dataKey: 'private_jets' },
      { key: 'military', label: t('layerPanel.layers.military'), icon: Shield, color: flightMil, dataKey: 'military_flights' },
    ],
  },
  {
    label: t('layerPanel.groups.maritime'),
    fullLabel: t('layerPanel.groups.maritime'),
    color: '#26C6DA',
    layers: [
      { key: 'maritime', label: t('layerPanel.layers.maritimeNaval'), icon: Ship, color: '#26C6DA', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
    ],
  },
  {
    label: t('layerPanel.groups.space'),
    fullLabel: t('layerPanel.groups.spaceFull'),
    color: '#D4AF37',
    layers: [
      { key: 'satellites', label: t('layerPanel.layers.allSatellites'), icon: Satellite, color: '#D4AF37', dataKey: 'satellites' },
      { key: 'sat_comms', label: t('layerPanel.layers.starlinkComms'), icon: Satellite, color: '#00E676', dataKey: 'satellites', catKey: 'comms' },
      { key: 'sat_military', label: t('layerPanel.layers.militaryIntel'), icon: Satellite, color: '#FF3D3D', dataKey: 'satellites', catKey: 'military' },
      { key: 'sat_navigation', label: t('layerPanel.layers.gpsNavigation'), icon: Satellite, color: '#448AFF', dataKey: 'satellites', catKey: 'navigation' },
      { key: 'sat_earth', label: t('layerPanel.layers.earthObservation'), icon: Satellite, color: '#90EE90', dataKey: 'satellites', catKey: 'earth_obs' },
      { key: 'sat_science', label: t('layerPanel.layers.stationsTelescopes'), icon: Satellite, color: '#FFD700', dataKey: 'satellites', catKey: 'science' },
    ],
  },
  {
    label: t('layerPanel.groups.surveil'),
    fullLabel: t('layerPanel.groups.surveilFull'),
    color: '#7E57C2',
    layers: [
      { key: 'cctv', label: t('layerPanel.layers.cctvCameras'), icon: Camera, color: '#7E57C2', dataKey: 'cameras' },
      { key: 'live_news', label: t('layerPanel.layers.liveNewsFeeds'), icon: Tv, color: '#EC407A', dataKey: 'live_feeds' },
    ],
  },
  {
    label: t('layerPanel.groups.hazard'),
    fullLabel: t('layerPanel.groups.hazardFull'),
    color: '#F9A825',
    layers: [
      { key: 'earthquakes', label: t('layerPanel.layers.earthquakes'), icon: Activity, color: '#F9A825', dataKey: 'earthquakes' },
      { key: 'fires', label: t('layerPanel.layers.activeFires'), icon: Flame, color: '#E65100', dataKey: 'fires' },
      { key: 'weather', label: t('layerPanel.layers.severeWeather'), icon: CloudLightning, color: '#7E57C2', dataKey: 'weather_events' },
    ],
  },
  {
    label: t('layerPanel.groups.threat'),
    fullLabel: t('layerPanel.groups.threatFull'),
    color: '#D32F2F',
    layers: [
      { key: 'infrastructure', label: t('layerPanel.layers.nuclearFacilities'), icon: Radiation, color: '#26A69A', dataKey: 'infrastructure' },
      { key: 'global_incidents', label: t('layerPanel.layers.globalIncidents'), icon: AlertTriangle, color: '#D32F2F', dataKey: 'gdelt' },
      { key: 'gps_jamming', label: t('layerPanel.layers.gpsJamming'), icon: Radio, color: '#D32F2F', dataKey: 'gps_jamming' },
    ],
  },
  {
    label: t('layerPanel.groups.network'),
    fullLabel: t('layerPanel.groups.networkFull'),
    color: '#D32F2F',
    layers: [
      { key: 'malware', label: t('layerPanel.layers.liveMalware'), icon: AlertTriangle, color: '#D32F2F', dataKey: 'malware_threats' },
    ],
  },
  {
    label: t('layerPanel.groups.display'),
    fullLabel: t('layerPanel.groups.display'),
    color: '#448AFF',
    layers: [
      { key: 'day_night', label: t('layerPanel.layers.dayNightCycle'), icon: Sun, color: '#448AFF', dataKey: '' },
      { key: 'terrain_3d', label: t('layerPanel.layers.terrain3d'), icon: Mountain, color: '#8D6E63', dataKey: '' },
    ],
  },
  ];
};

// SVG component for Shield which was missing in the imports above
function Shield(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function LayerPanel({ data, activeLayers, setActiveLayers, isMobile, theme = 'core', setTheme }: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const { t } = useLanguage();

  const LAYER_GROUPS = getLayerGroups(t, theme);
  const ALL_LAYERS = LAYER_GROUPS.flatMap(g => g.layers);

  const toggle = (key: string) => setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  
  const getCount = (dk: string, catKey?: string): number | null => {
    if (!dk) return null;
    // For satellite sub-layers, use category_counts from the API
    if (catKey && data.category_counts) {
      return data.category_counts[catKey] || 0;
    }
    let total = 0;
    let found = false;
    for (const k of dk.split(',')) {
      if (data[k] && Array.isArray(data[k])) {
        total += data[k].length;
        found = true;
      }
    }
    return found ? total : null;
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 py-2">
        {LAYER_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div 
              className="text-[10px] font-bold font-mono tracking-widest border-b border-white/10 pb-1"
              style={{ color: group.color }}
            >
              {group.fullLabel}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.layers.map((layer) => {
                const isLayerActive = activeLayers[layer.key];
                const count = getCount(layer.dataKey, layer.catKey);
                
                return (
                  <button
                    key={layer.key}
                    onClick={() => {
                      if (layer.key === 'sdk_ransomware') {
                        alert(t('layerPanel.comingSoon'));
                      } else {
                        toggle(layer.key);
                      }
                    }}
                    className={`flex items-center gap-2 px-2 py-2 rounded border transition-colors ${
                      isLayerActive 
                        ? 'bg-white/10 border-white/20' 
                        : 'bg-transparent border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div 
                      className={`w-2 h-2 rounded-full border flex-shrink-0 transition-all ${
                        isLayerActive ? 'bg-current border-current scale-100' : 'bg-transparent border-white/30 scale-75'
                      }`}
                      style={{ color: isLayerActive ? layer.color : 'inherit', boxShadow: isLayerActive ? `0 0 8px ${layer.color}` : 'none' }}
                    />
                    <span className={`text-[9px] font-mono uppercase tracking-wider flex-1 text-left ${isLayerActive ? 'text-white' : 'text-white/60'}`}>
                      {layer.label}
                    </span>
                    {count !== null && (
                      <span className="text-[8px] font-mono tabular-nums opacity-60">
                        {count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* MOBILE THEME TOGGLE */}
        {setTheme && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-primary)] px-2">
            <div className="text-[10px] font-bold font-mono tracking-widest text-[var(--text-secondary)]">
              {t('layerPanel.ghostMode')}
            </div>
            <button
              onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
              className="relative w-12 h-6 rounded-full transition-all duration-500 ease-in-out border flex items-center px-0.5 cursor-pointer hover:shadow-lg"
              style={{
                backgroundColor: theme === 'ghost' ? 'rgba(179, 136, 255, 0.15)' : 'rgba(0,0,0,0.4)',
                borderColor: theme === 'ghost' ? 'rgba(179, 136, 255, 0.5)' : 'rgba(255,255,255,0.1)',
                boxShadow: theme === 'ghost' ? '0 0 15px rgba(179, 136, 255, 0.3), inset 0 0 8px rgba(179, 136, 255, 0.2)' : 'inset 0 0 5px rgba(0,0,0,0.5)'
              }}
            >
              <motion.div 
                layout
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.4)',
                  boxShadow: theme === 'ghost' ? '0 0 10px #B388FF' : 'none'
                }}
                animate={{ x: theme === 'ghost' ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        )}

      </div>
    );
  }

  return (
    <motion.div 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 left-0 h-full w-[80px] border-r border-[var(--border-primary)] flex flex-col pt-32 pb-8 z-50 pointer-events-auto bg-[var(--bg-panel)] backdrop-blur-[24px] saturate-150"
      style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.5)' }}
    >
      
      <div className="flex-1 flex flex-col gap-8 px-2">
        {LAYER_GROUPS.map((group) => {
          const groupActiveCount = group.layers.filter(l => activeLayers[l.key]).length;
          const isActive = groupActiveCount > 0;
          const isHovered = hoveredGroup === group.label;

          return (
            <div 
              key={group.label} 
              className="relative flex justify-center items-center"
              onMouseEnter={() => setHoveredGroup(group.label)}
              onMouseLeave={() => setHoveredGroup(null)}
            >
              {/* The Vertical Label */}
              <div 
                className={`text-[10px] font-mono font-bold cursor-pointer select-none transition-all duration-300 flex items-center justify-center`}
                style={{
                  writingMode: 'horizontal-tb',
                  color: isActive ? group.color : 'rgba(255, 255, 255, 0.4)',
                  textShadow: isActive ? `0 0 10px ${group.color}80` : 'none',
                  letterSpacing: '0.1em',
                  opacity: isActive || isHovered ? 1 : 0.5,
                }}
              >
                {/* Active Indicator dot */}
                {isActive && (
                  <div 
                    className="absolute -left-1 w-1 h-1 rounded-full animate-pulse"
                    style={{ backgroundColor: group.color, boxShadow: `0 0 8px ${group.color}` }}
                  />
                )}
                {group.label}
              </div>

              {/* Slide-out Menu */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -5, filter: 'blur(2px)' }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute left-[70px] top-1/2 -translate-y-1/2 min-w-[240px] bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl z-50 pointer-events-auto"
                    style={{
                      boxShadow: `0 0 30px ${group.color}15, inset 0 0 20px ${group.color}05`
                    }}
                  >
                    <div className="text-[11px] font-bold font-mono mb-3 tracking-widest border-b border-white/10 pb-2" style={{ color: group.color }}>
                      {group.fullLabel}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {group.layers.map((layer) => {
                        const isLayerActive = activeLayers[layer.key];
                        const count = getCount(layer.dataKey, layer.catKey);
                        const Icon = layer.icon || Shield;
                        
                        return (
                          <button
                            key={layer.key}
                            onClick={() => {
                              if (layer.key === 'sdk_ransomware') {
                                alert(t('layerPanel.comingSoon'));
                              } else {
                                toggle(layer.key);
                              }
                            }}
                            className="w-full flex items-center gap-3 px-2 py-1.5 rounded bg-transparent hover:bg-white/5 transition-colors group"
                          >
                            <div 
                              className={`w-2 h-2 rounded-full border flex-shrink-0 transition-all duration-300 ${isLayerActive ? 'bg-current border-current scale-100' : 'bg-transparent border-white/30 scale-75'}`}
                              style={{ color: isLayerActive ? layer.color : 'inherit', boxShadow: isLayerActive ? `0 0 8px ${layer.color}` : 'none' }}
                            />
                            <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 text-left transition-colors duration-200 ${isLayerActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
                              {layer.label}
                            </span>
                            {count !== null && (
                              <span className="text-[9px] font-mono tabular-nums opacity-60">
                                {count.toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* DESKTOP THEME TOGGLE */}
      {setTheme && (
        <div className="mt-auto px-2 pt-6 pb-2 border-t border-[var(--border-primary)] flex flex-col items-center gap-3 relative z-50">
          <div className="text-[9px] font-mono tracking-[0.25em] text-[var(--text-secondary)]">{t('layerPanel.ghostProtocol')}</div>
          <button
            onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
            className="relative w-14 h-7 rounded-full transition-all duration-500 ease-in-out border flex items-center px-1 cursor-pointer hover:shadow-lg"
            style={{
              backgroundColor: theme === 'ghost' ? 'rgba(179, 136, 255, 0.15)' : 'rgba(0,0,0,0.4)',
              borderColor: theme === 'ghost' ? 'rgba(179, 136, 255, 0.5)' : 'rgba(255,255,255,0.1)',
              boxShadow: theme === 'ghost' ? '0 0 15px rgba(179, 136, 255, 0.3), inset 0 0 8px rgba(179, 136, 255, 0.2)' : 'inset 0 0 5px rgba(0,0,0,0.5)'
            }}
          >
            <motion.div 
              layout
              className="w-5 h-5 rounded-full"
              style={{
                backgroundColor: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.4)',
                boxShadow: theme === 'ghost' ? '0 0 10px #B388FF' : 'none'
              }}
              animate={{ x: theme === 'ghost' ? 28 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      )}

    </motion.div>
  );
}

export default memo(LayerPanel);
