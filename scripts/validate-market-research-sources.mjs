import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const ts = requireFromHere('typescript');
const root = process.cwd();
const moduleCache = new Map();

function resolveTsModule(fromFile, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${specifier} from ${fromFile}`);
}

function loadTsModule(filePath) {
  const resolved = path.resolve(filePath);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;

  const source = fs.readFileSync(resolved, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: resolved,
  }).outputText;

  const cjsModule = { exports: {} };
  moduleCache.set(resolved, cjsModule);

  const localRequire = specifier => {
    const next = resolveTsModule(resolved, specifier);
    return next.endsWith('.ts') || next.endsWith('.tsx') ? loadTsModule(next) : requireFromHere(next);
  };

  vm.runInNewContext(output, {
    exports: cjsModule.exports,
    module: cjsModule,
    require: localRequire,
    console,
  }, { filename: resolved });

  return cjsModule.exports;
}

const types = loadTsModule(path.join(root, 'src/lib/market-research-source-types.ts'));
const catalog = loadTsModule(path.join(root, 'src/lib/market-research-sources.ts'));
const sources = catalog.marketResearchSources;
const requiredCategories = types.MARKET_SOURCE_CATEGORIES;

const failures = [];
const seenIds = new Set();
const categoryCounts = Object.fromEntries(requiredCategories.map(category => [category, 0]));

const allowed = {
  category: new Set(types.MARKET_SOURCE_CATEGORIES),
  access: new Set(types.MARKET_SOURCE_ACCESS),
  auth: new Set(types.MARKET_SOURCE_AUTH),
  cadence: new Set(types.MARKET_SOURCE_CADENCES),
  coverage: new Set(types.MARKET_SOURCE_COVERAGE),
  output: new Set(types.MARKET_SOURCE_OUTPUTS),
  gisMode: new Set(types.MARKET_SOURCE_GIS_MODES),
  status: new Set(types.MARKET_SOURCE_STATUSES),
};

function fail(id, message) {
  failures.push(`${id}: ${message}`);
}

function assertUrl(id, field, value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) fail(id, `${field} must use http/https`);
    if (url.username || url.password) fail(id, `${field} must not include credentials`);
  } catch {
    fail(id, `${field} is not a valid URL`);
  }
}

if (!Array.isArray(sources)) {
  throw new Error('marketResearchSources must be an array');
}

for (const source of sources) {
  const id = source.id || '<missing-id>';

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(id, 'id must be kebab-case');
  if (seenIds.has(id)) fail(id, 'duplicate id');
  seenIds.add(id);

  for (const field of ['name', 'provider', 'summary', 'endpointUrl', 'docsUrl', 'spatialResolution', 'licenseNotes']) {
    if (typeof source[field] !== 'string' || source[field].trim().length < 3) {
      fail(id, `${field} is required`);
    }
  }

  for (const field of ['category', 'access', 'auth', 'cadence', 'coverage', 'output', 'gisMode', 'status']) {
    if (!allowed[field].has(source[field])) fail(id, `${field} has invalid value "${source[field]}"`);
  }

  if (source.category in categoryCounts) categoryCounts[source.category] += 1;
  assertUrl(id, 'endpointUrl', source.endpointUrl);
  assertUrl(id, 'docsUrl', source.docsUrl);

  if (!Array.isArray(source.joinKeys) || source.joinKeys.length === 0) fail(id, 'joinKeys must be non-empty');
  if (!Array.isArray(source.caveats) || source.caveats.length === 0) fail(id, 'caveats must be non-empty');
  if (!source.caveats?.some(caveat => caveat.includes('provider location'))) fail(id, 'must disclose provider-location marker caveat');

  const { lat, lng, label } = source.location || {};
  if (typeof label !== 'string' || label.length < 3) fail(id, 'location.label is required');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) fail(id, 'location.lat must be within -90..90');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) fail(id, 'location.lng must be within -180..180');

  for (const [key, value] of Object.entries(source.scores || {})) {
    if (!Number.isInteger(value) || value < 0 || value > 5) fail(id, `score ${key} must be integer 0..5`);
  }

  if (source.access === 'commercial' && source.auth !== 'commercial_contract' && source.auth !== 'account_key') {
    fail(id, 'commercial sources must declare account or contract auth');
  }
}

for (const category of requiredCategories) {
  if ((categoryCounts[category] || 0) < 8) fail(category, 'category must have at least 8 sources');
}

if (sources.length < 50) fail('catalog', 'must include at least 50 sources');

if (failures.length > 0) {
  console.error(`Market source catalog validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validated market research source catalog: ${sources.length} sources across ${requiredCategories.length} categories`);
for (const category of requiredCategories) {
  console.log(`- ${category}: ${categoryCounts[category]}`);
}
