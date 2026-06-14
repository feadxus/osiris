(() => {
  const startedAt = Date.now();
  const MAX_WAIT_MS = 15000;

  function addVisibilityCss() {
    if (document.getElementById('osiris-map-visibility-css')) return;
    const style = document.createElement('style');
    style.id = 'osiris-map-visibility-css';
    style.textContent = `
      body.primary-real-map .real-map-layer,
      body.real-map-mode .real-map-layer{
        background:#0b0f14!important;
        filter:none!important;
      }
      body.primary-real-map .maplibregl-canvas,
      body.real-map-mode .maplibregl-canvas{
        filter:none!important;
        opacity:1!important;
      }
      body.primary-real-map .space-vignette,
      body.real-map-mode .space-vignette{
        background:linear-gradient(180deg,rgba(2,3,10,.18),rgba(2,3,10,0) 16%,rgba(2,3,10,0) 82%,rgba(2,3,10,.22))!important;
      }
      body.primary-real-map .scan-lines,
      body.real-map-mode .scan-lines{
        opacity:.025!important;
        mix-blend-mode:screen!important;
      }
      body.primary-real-map .osiris-live,
      body.real-map-mode .osiris-live{
        background:#0b0f14!important;
      }
      body.primary-real-map .live-header,
      body.real-map-mode .live-header{
        text-shadow:0 2px 16px rgba(0,0,0,.72);
      }
      body.primary-real-map .system-copy,
      body.real-map-mode .system-copy{
        opacity:.42!important;
        color:rgba(240,246,250,.48)!important;
      }
    `;
    document.head.appendChild(style);
  }

  function safeCall(fn) {
    try { return fn(); } catch { return undefined; }
  }

  function addReadableLabelOverlay(map) {
    if (!map || map.__osirisVisibilityFixed) return true;
    if (!safeCall(() => map.isStyleLoaded())) return false;
    map.__osirisVisibilityFixed = true;

    safeCall(() => map.setPaintProperty('carto-base', 'raster-opacity', 1));
    safeCall(() => map.setLayoutProperty('osiris-labels', 'visibility', 'visible'));
    safeCall(() => map.setPaintProperty('osiris-labels', 'text-color', '#fff1a3'));
    safeCall(() => map.setPaintProperty('osiris-labels', 'text-halo-color', '#05070b'));
    safeCall(() => map.setPaintProperty('osiris-labels', 'text-halo-width', 2.2));
    safeCall(() => map.setPaintProperty('osiris-labels', 'text-opacity', 1));

    if (!safeCall(() => map.getSource('cartoReadableLabels'))) {
      safeCall(() => map.addSource('cartoReadableLabels', {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO'
      }));
    }

    if (!safeCall(() => map.getLayer('carto-readable-labels'))) {
      const beforeLayer = safeCall(() => map.getLayer('osiris-cables')) ? 'osiris-cables' : undefined;
      safeCall(() => map.addLayer({
        id: 'carto-readable-labels',
        type: 'raster',
        source: 'cartoReadableLabels',
        paint: {
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.68, 6, 0.9, 10, 1],
          'raster-brightness-min': 0.05,
          'raster-brightness-max': 1
        }
      }, beforeLayer));
    }

    if (!safeCall(() => map.getSource('cartoStreetLabels'))) {
      safeCall(() => map.addSource('cartoStreetLabels', {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/voyager_only_labels/{z}/{x}/{y}{r}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO'
      }));
    }

    if (!safeCall(() => map.getLayer('carto-street-labels'))) {
      safeCall(() => map.addLayer({
        id: 'carto-street-labels',
        type: 'raster',
        source: 'cartoStreetLabels',
        minzoom: 11,
        paint: {
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 0.78, 16, 1],
          'raster-brightness-min': 0,
          'raster-brightness-max': 1
        }
      }));
    }

    safeCall(() => map.setMaxZoom(20));
    safeCall(() => map.resize());
    return true;
  }

  function install() {
    addVisibilityCss();
    const map = window.__osirisRealMap;
    if (addReadableLabelOverlay(map)) return;
    if (Date.now() - startedAt > MAX_WAIT_MS) return;
    setTimeout(install, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
