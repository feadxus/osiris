# OSIRIS Public Data Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first public-data expansion wave: a safe connector foundation, OpenAQ v3 air-quality behavior, GDACS/ReliefWeb disaster intelligence and EPSS-based cyber prioritization.

**Architecture:** Add focused connector modules under `src/lib/integrations/` and keep App Router route handlers thin. Preserve existing response contracts where routes already exist, and add explicit `enabled` / `partial` source status for integrations that now require credentials or approved app names.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Node 25 built-in test runner with `--experimental-strip-types`, public HTTP JSON/RSS APIs.

---

## Files

- Create: `src/lib/integrations/source-metadata.ts`
- Create: `src/lib/integrations/openaq.ts`
- Create: `src/lib/integrations/disasters.ts`
- Create: `src/lib/integrations/cyber-priority.ts`
- Modify: `src/app/api/air-quality/route.ts`
- Create: `src/app/api/disasters/route.ts`
- Create: `src/app/api/cyber-priority/route.ts`
- Modify: `src/app/api/osint/cve/route.ts`
- Modify: `src/app/api/cyber-threats/route.ts`
- Create: `src/lib/integrations/*.test.ts`
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-06-04-osiris-public-data-integrations-design.md`

## Task 1: Connector Foundation and Tests

**Files:**
- Create: `src/lib/integrations/source-metadata.ts`
- Create: `src/lib/integrations/openaq.ts`
- Create: `src/lib/integrations/disasters.ts`
- Create: `src/lib/integrations/cyber-priority.ts`
- Create: `src/lib/integrations/openaq.test.ts`
- Create: `src/lib/integrations/disasters.test.ts`
- Create: `src/lib/integrations/cyber-priority.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests**

Create Node test files that import the TypeScript normalizer functions directly:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpenAqLatestResult } from './openaq.ts';

test('normalizes OpenAQ v3 latest PM2.5 records into station output', () => {
  const station = normalizeOpenAqLatestResult({
    locationsId: 42,
    location: 'Station A',
    coordinates: { latitude: 48.1, longitude: 11.6 },
    parameter: { name: 'pm25', units: 'µg/m³' },
    value: 18.3,
    datetime: { utc: '2026-06-04T08:00:00Z' },
    country: { code: 'DE' },
  });

  assert.equal(station?.id, 'aq-42-pm25');
  assert.equal(station?.pm25, 18.3);
  assert.equal(station?.level, 'Good');
});
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test:integrations
```

Expected: fails because the test script or modules do not exist yet.

- [ ] **Step 3: Implement connector modules**

Add typed normalizers and small fetch helpers. Each connector must return source metadata and never throw for expected disabled states.

- [ ] **Step 4: Verify green**

Run:

```bash
npm run test:integrations
```

Expected: all integration normalizer tests pass.

## Task 2: Air Quality Route

**Files:**
- Modify: `src/app/api/air-quality/route.ts`
- Test: `src/lib/integrations/openaq.test.ts`

- [ ] **Step 1: Extend failing tests**

Add tests for disabled OpenAQ behavior when no API key is configured and for unhealthy PM2.5 classification.

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test:integrations
```

Expected: fails until disabled-state helpers and classifications exist.

- [ ] **Step 3: Implement route**

Use `OPENAQ_API_KEY` in the `X-API-Key` header. If missing, return `200` with `stations: []`, `enabled: false`, source status and a setup message. If configured, call OpenAQ v3 `/v3/parameters/2/latest` and preserve the existing `stations`, `total`, `timestamp` contract.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test:integrations
curl -sS http://localhost:3001/api/air-quality
```

Expected without key: JSON response is non-failing and clearly disabled.

## Task 3: Disaster Intelligence Route

**Files:**
- Create: `src/app/api/disasters/route.ts`
- Test: `src/lib/integrations/disasters.test.ts`

- [ ] **Step 1: Write failing tests**

Test GDACS RSS and GDACS API feature normalization plus ReliefWeb disabled behavior without `RELIEFWEB_APP_NAME`.

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test:integrations
```

Expected: disaster tests fail until the normalizers are complete.

- [ ] **Step 3: Implement route**

Fetch GDACS GeoJSON API keylessly. If `RELIEFWEB_APP_NAME` exists, also POST to ReliefWeb v2 reports. If ReliefWeb is not configured or denied, return GDACS data and mark ReliefWeb disabled/error in `sources`.

- [ ] **Step 4: Verify**

Run:

```bash
curl -sS http://localhost:3001/api/disasters
```

Expected: a JSON response with `events`, `reports`, `sources`, `total`, and `timestamp`; GDACS should work without keys.

## Task 4: Cyber Priority Route and CVE Enrichment

**Files:**
- Create: `src/app/api/cyber-priority/route.ts`
- Modify: `src/app/api/osint/cve/route.ts`
- Modify: `src/app/api/cyber-threats/route.ts`
- Test: `src/lib/integrations/cyber-priority.test.ts`

- [ ] **Step 1: Write failing tests**

Test EPSS scoring thresholds and merged CVE priority calculation.

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test:integrations
```

Expected: cyber-priority tests fail until scoring helpers exist.

- [ ] **Step 3: Implement route and enrichment**

Add `/api/cyber-priority?cves=CVE-2024-3094,CVE-2023-...` for explicit CVEs and default to recent CISA KEV CVEs when no query is supplied. Add EPSS fields to `/api/osint/cve` responses. Keep `/api/cyber-threats` compatible, adding priority stats rather than replacing existing fields.

- [ ] **Step 4: Verify**

Run:

```bash
curl -sS 'http://localhost:3001/api/cyber-priority?cves=CVE-2024-3094'
curl -sS 'http://localhost:3001/api/osint/cve?cve=CVE-2024-3094'
```

Expected: responses include EPSS probability/percentile and a clear priority label.

## Task 5: Final Verification

**Files:**
- All changed implementation files.

- [ ] **Step 1: Type/build check**

Run:

```bash
npm run build
```

Expected: production build succeeds.

- [ ] **Step 2: Targeted route smoke checks**

Run:

```bash
curl -sS http://localhost:3001/api/air-quality
curl -sS http://localhost:3001/api/disasters
curl -sS 'http://localhost:3001/api/cyber-priority?cves=CVE-2024-3094'
```

Expected: all return JSON and no route crashes.

- [ ] **Step 3: Browser smoke**

Open `http://localhost:3001`, verify the dashboard still renders and no framework overlay appears.
