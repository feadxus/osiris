import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const port = Number(process.env.MARKET_SMOKE_PORT || 43175);
const chromePort = Number(process.env.MARKET_SMOKE_CHROME_PORT || 43176);
const args = new Set(process.argv.slice(2));
const runStatic = args.size === 0 || args.has('--static');
const runApi = args.size === 0 || args.has('--api');
const runUi = args.size === 0 || args.has('--ui') || args.has('--map');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(fn, label, timeoutMs = 45000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  const json = await response.json();
  return { response, json };
}

async function startNext() {
  const child = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_OSIRIS_SMOKE: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = [];
  const record = chunk => {
    const text = chunk.toString();
    logs.push(text);
    if (logs.join('').length > 12000) logs.shift();
  };
  child.stdout.on('data', record);
  child.stderr.on('data', record);

  await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/market-sources`);
      return response.ok;
    } catch {
      return false;
    }
  }, 'Next dev server');

  return {
    child,
    stop: () => {
      child.kill('SIGTERM');
    },
    logs: () => logs.join(''),
  };
}

async function chromeJson(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: chromePort,
      path: pathname,
      method: pathname.startsWith('/json/new') ? 'PUT' : 'GET',
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function cdpConnect(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  ws.addEventListener('message', event => {
    const payload = JSON.parse(event.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolve(payload.result);
    }
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((sendResolve, sendReject) => {
            pending.set(messageId, { resolve: sendResolve, reject: sendReject });
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener('error', reject);
  });
}

async function evaluate(client, expression, timeoutMs = 45000) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: timeoutMs,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result.value;
}

async function runBrowserSmoke() {
  const userDataDir = `/tmp/osiris-market-smoke-${process.pid}`;
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-gl=swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  await waitFor(async () => {
    try {
      await chromeJson('/json/version');
      return true;
    } catch {
      return false;
    }
  }, 'Chrome DevTools endpoint');

  const target = await chromeJson(`/json/new?${encodeURIComponent(`http://127.0.0.1:${port}/`)}`);
  const client = await cdpConnect(target.webSocketDebuggerUrl);

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });

    await evaluate(client, `
      new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
          if (document.body && document.body.innerText.includes('DATA LAYERS')) resolve(true);
          else if (Date.now() - started > 45000) reject(new Error('DATA LAYERS not visible'));
          else setTimeout(tick, 250);
        };
        tick();
      })
    `);

    await evaluate(client, `
      new Promise(resolve => setTimeout(resolve, 3200))
    `, 5000);

    const result = await evaluate(client, `
      (async () => {
        const byText = (selector, text) => Array.from(document.querySelectorAll(selector))
          .find(el => (el.textContent || '').toUpperCase().includes(text));
        const layerButton = Array.from(document.querySelectorAll('button'))
          .find(button => Array.from(button.querySelectorAll('span'))
            .some(span => (span.textContent || '').trim() === 'Market Sources'));
        if (!layerButton) throw new Error('MARKET SOURCES layer button missing');
        layerButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        const cpgTab = byText('button', 'CPG');
        if (!cpgTab) throw new Error('CPG tab missing');
        cpgTab.click();
        await new Promise(resolve => setTimeout(resolve, 600));

        const catalogText = document.body.innerText;
        if (!catalogText.includes('Foursquare Places API')) throw new Error('Foursquare source not visible after CPG filter');
        if (!catalogText.includes('MARKET SOURCES')) throw new Error('Market source panel text missing');

        const map = window.__OSIRIS_MAP__;
        if (!map) throw new Error('OSIRIS smoke map hook missing');
        const layerIds = ['market-sources-glow', 'market-sources-dots', 'market-sources-label'];
        const missingLayer = layerIds.find(id => !map.getLayer(id));
        if (missingLayer) throw new Error('Map layer missing: ' + missingLayer);
        if (!map.getSource('market-sources')) throw new Error('Map source missing: market-sources');

        await new Promise((resolve, reject) => {
          const started = Date.now();
          const tick = () => {
            const count = window.__OSIRIS_MARKET_SOURCE_COUNT__ || 0;
            const visibility = map.getLayoutProperty('market-sources-dots', 'visibility');
            if (count > 0 && visibility !== 'none') resolve({ count, visibility: visibility || 'visible' });
            else if (Date.now() - started > 25000) reject(new Error('market source features not visible'));
            else setTimeout(tick, 500);
          };
          tick();
        });
        const sample = window.__OSIRIS_MARKET_SOURCE_SAMPLE__;
        if (!sample || sample.id !== 'foursquare-places') throw new Error('Foursquare sample marker missing');
        const [sampleLng, sampleLat] = sample.coordinates;
        if (Math.abs(sampleLng - -73.9897) > 0.0001 || Math.abs(sampleLat - 40.7411) > 0.0001) {
          throw new Error('Foursquare sample marker coordinates are wrong');
        }

        layerButton.click();
        await new Promise(resolve => setTimeout(resolve, 800));
        const hidden = map.getLayoutProperty('market-sources-dots', 'visibility') === 'none';
        if (!hidden) throw new Error('Market sources layer did not turn off');
        layerButton.click();
        await new Promise(resolve => setTimeout(resolve, 800));
        const visibleAgain = map.getLayoutProperty('market-sources-dots', 'visibility') !== 'none';
        if (!visibleAgain) throw new Error('Market sources layer did not turn on');

        return {
          panelVisible: true,
          sourceCount: window.__OSIRIS_MARKET_SOURCE_COUNT__,
          toggled: true,
        };
      })()
    `, 70000);

    console.log(`Browser smoke passed: ${result.sourceCount} map features, layer toggled off/on`);
  } finally {
    client.close();
    chrome.kill('SIGTERM');
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      setTimeout(() => fs.rmSync(userDataDir, { recursive: true, force: true }), 500).unref();
    }
  }
}

function runStaticChecks() {
  const page = read('src/app/page.tsx');
  const map = read('src/components/OsirisMap.tsx');
  const layerPanel = read('src/components/LayerPanel.tsx');
  const panel = read('src/components/MarketSourcesPanel.tsx');

  assert(page.includes('/api/market-sources'), 'page.tsx must fetch /api/market-sources');
  assert(page.includes('<MarketSourcesPanel'), 'page.tsx must render MarketSourcesPanel');
  assert(layerPanel.includes('market_sources'), 'LayerPanel must include market_sources toggle');
  assert(panel.includes('MARKET SOURCES'), 'MarketSourcesPanel must include visible MARKET SOURCES heading');
  assert(map.includes("'market-sources'"), 'OsirisMap must add market-sources source');
  assert(map.includes('market-sources-dots'), 'OsirisMap must add market-sources-dots layer');
  assert(map.includes('__OSIRIS_MAP__'), 'OsirisMap must expose smoke map hook');
  console.log('Static smoke passed: UI, API, and MapLibre wiring present');
}

let server;
try {
  if (runStatic) runStaticChecks();

  if (runApi || runUi) {
    server = await startNext();
    const { response, json } = await fetchJson(`http://127.0.0.1:${port}/api/market-sources`);
    assert(response.ok, 'market-sources API must return 200');
    assert(response.headers.get('cache-control')?.includes('s-maxage=86400'), 'cache header must include s-maxage=86400');
    assert(Array.isArray(json.sources), 'API sources must be an array');
    assert(json.sources.length >= 50, 'API must return at least 50 sources');
    assert(json.sources.some(source => source.id === 'ipums-nhgis'), 'API must include IPUMS NHGIS');
    assert(json.sources.some(source => source.id === 'foursquare-places'), 'API must include Foursquare Places');
    console.log(`API smoke passed: ${json.sources.length} sources`);
  }

  if (runUi) await runBrowserSmoke();
} catch (error) {
  console.error(error.message);
  if (server) console.error(server.logs());
  process.exit(1);
} finally {
  server?.stop();
}
