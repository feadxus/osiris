import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGermanyRailInfrastructureQuery,
  buildStationOperationStatus,
  classifyRailOperationStatus,
  fetchStationDepartures,
  GERMANY_RAIL_HUBS,
  staticGermanyRailInfrastructure,
  normalizeDbDeparture,
  normalizeOverpassRailElement,
  normalizeStaticRailHub,
} from './rail-germany.ts';

test('builds a Germany-only rail infrastructure query without operational departures', () => {
  const query = buildGermanyRailInfrastructureQuery(80);

  assert.match(query, /ISO3166-1"="DE/);
  assert.match(query, /railway"="rail/);
  assert.match(query, /station\|halt\|yard\|depot\|junction/);
  assert.doesNotMatch(query, /departures|delay|trip|journey/i);
});

test('normalizes German static rail hubs as infrastructure facilities', () => {
  const hub = normalizeStaticRailHub(GERMANY_RAIL_HUBS[0]);

  assert.equal(hub.id, 'rail-de-hub-8011160');
  assert.equal(hub.kind, 'station');
  assert.equal(hub.name, 'Berlin Hbf');
  assert.equal(hub.lat, 52.525592);
  assert.equal(hub.lng, 13.369545);
  assert.equal(hub.source.feed, 'rail-germany-infrastructure');
});

test('includes static German trunk rail corridors when Overpass is unavailable', () => {
  const infrastructure = staticGermanyRailInfrastructure();
  const lines = infrastructure.filter(item => item.kind === 'line');

  assert.ok(lines.length >= 5);
  assert.equal(lines[0].geometry?.type, 'LineString');
  assert.ok((lines[0].geometry?.coordinates.length || 0) >= 2);
  assert.equal(lines[0].source.feed, 'rail-germany-infrastructure');
});

test('normalizes Overpass rail stations with operator and UIC metadata', () => {
  const facility = normalizeOverpassRailElement({
    type: 'node',
    id: 123,
    lat: 52.525592,
    lon: 13.369545,
    tags: {
      railway: 'station',
      name: 'Berlin Hauptbahnhof',
      operator: 'DB InfraGO',
      uic_ref: '8011160',
      network: 'DB',
    },
  });

  assert.deepEqual(facility && {
    id: facility.id,
    kind: facility.kind,
    name: facility.name,
    operator: facility.operator,
    uicRef: facility.uicRef,
    network: facility.network,
    lat: facility.lat,
    lng: facility.lng,
  }, {
    id: 'rail-de-uic-8011160',
    kind: 'station',
    name: 'Berlin Hauptbahnhof',
    operator: 'DB InfraGO',
    uicRef: '8011160',
    network: 'DB',
    lat: 52.525592,
    lng: 13.369545,
  });
});

test('normalizes Overpass railway ways as line infrastructure geometry', () => {
  const line = normalizeOverpassRailElement({
    type: 'way',
    id: 987,
    tags: {
      railway: 'rail',
      name: 'Berlin-Hamburg railway',
      operator: 'DB Netz',
      electrified: 'contact_line',
      usage: 'main',
      gauge: '1435',
    },
    geometry: [
      { lat: 52.52, lon: 13.36 },
      { lat: 52.6, lon: 13.2 },
      { lat: 52.8, lon: 12.9 },
    ],
  });

  assert.equal(line?.id, 'rail-de-way-987');
  assert.equal(line?.kind, 'line');
  assert.equal(line?.operator, 'DB Netz');
  assert.equal(line?.electrified, 'contact_line');
  assert.equal(line?.usage, 'main');
  assert.deepEqual(line?.geometry, {
    type: 'LineString',
    coordinates: [
      [13.36, 52.52],
      [13.2, 52.6],
      [12.9, 52.8],
    ],
  });
});

test('drops non-rail or coordinate-less rail elements', () => {
  assert.equal(normalizeOverpassRailElement({ type: 'node', id: 1, tags: { amenity: 'cafe' } }), null);
  assert.equal(normalizeOverpassRailElement({ type: 'way', id: 2, tags: { railway: 'rail' }, geometry: [{ lat: 1 }] }), null);
});

test('classifies live German rail operational status from delay and cancellation signals', () => {
  assert.equal(classifyRailOperationStatus({ plannedWhen: '2026-06-04T10:00:00+02:00', when: '2026-06-04T10:01:00+02:00' }), 'on_time');
  assert.equal(classifyRailOperationStatus({ plannedWhen: '2026-06-04T10:00:00+02:00', when: '2026-06-04T10:08:00+02:00' }), 'delayed');
  assert.equal(classifyRailOperationStatus({ plannedWhen: '2026-06-04T10:00:00+02:00', when: '2026-06-04T10:18:00+02:00' }), 'severe');
  assert.equal(classifyRailOperationStatus({ plannedWhen: '2026-06-04T10:00:00+02:00', when: '2026-06-04T10:00:00+02:00', cancelled: true }), 'cancelled');
});

test('normalizes db.transport.rest departures as separate live operations', () => {
  const departure = normalizeDbDeparture({
    tripId: '1|123|0|80|4062026',
    line: { name: 'ICE 100', productName: 'ICE' },
    direction: 'Hamburg-Altona',
    when: '2026-06-04T10:12:00+02:00',
    plannedWhen: '2026-06-04T10:00:00+02:00',
    platform: '7',
    plannedPlatform: '8',
    cancelled: false,
  });

  assert.deepEqual(departure, {
    id: '1|123|0|80|4062026',
    line: 'ICE 100',
    product: 'ICE',
    direction: 'Hamburg-Altona',
    when: '2026-06-04T10:12:00+02:00',
    plannedWhen: '2026-06-04T10:00:00+02:00',
    delayMinutes: 12,
    status: 'delayed',
    platform: '7',
    plannedPlatform: '8',
    platformChanged: true,
  });
});

test('uses db.transport.rest delay seconds when normalizing departures', () => {
  const departure = normalizeDbDeparture({
    tripId: 'delay-field',
    line: { name: 'RE 1', product: 'regional' },
    direction: 'Magdeburg Hbf',
    plannedWhen: '2026-06-04T10:00:00+02:00',
    when: '2026-06-04T10:00:00+02:00',
    delay: 900,
  });

  assert.equal(departure?.delayMinutes, 15);
  assert.equal(departure?.status, 'severe');
});

test('parses db.transport.rest departure arrays', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([
    {
      tripId: 'array-response',
      line: { name: 'ICE 100', productName: 'ICE' },
      direction: 'Hamburg-Altona',
      delay: 300,
      cancelled: false,
    },
  ]), { status: 200, headers: { 'content-type': 'application/json' } });

  try {
    const departures = await fetchStationDepartures('8011160', 1);
    assert.equal(departures.length, 1);
    assert.equal(departures[0].id, 'array-response');
    assert.equal(departures[0].status, 'delayed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('builds station-level live operations without mutating infrastructure records', () => {
  const station = GERMANY_RAIL_HUBS[0];
  const status = buildStationOperationStatus(station, [
    {
      id: 'ice-1',
      line: 'ICE 1',
      delayMinutes: 0,
      status: 'on_time',
      platformChanged: false,
    },
    {
      id: 'ice-2',
      line: 'ICE 2',
      delayMinutes: 22,
      status: 'severe',
      platformChanged: true,
    },
  ]);

  assert.equal(status.stationId, '8011160');
  assert.equal(status.stationName, 'Berlin Hbf');
  assert.equal(status.status, 'severe');
  assert.equal(status.delayedDepartures, 0);
  assert.equal(status.severeDepartures, 1);
  assert.equal(status.platformChanges, 1);
  assert.equal(status.source.feed, 'rail-germany-operations');
});
