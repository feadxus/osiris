import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenAqDisabledResponse,
  classifyPm25,
  normalizeOpenAqLatestResult,
} from './openaq.ts';

test('normalizes OpenAQ v3 latest PM2.5 records into station output', () => {
  const station = normalizeOpenAqLatestResult({
    locationsId: 42,
    location: 'Station A',
    coordinates: { latitude: 48.1, longitude: 11.6 },
    parameter: { name: 'pm25', units: 'µg/m3' },
    value: 18.3,
    datetime: { utc: '2026-06-04T08:00:00Z' },
    country: { code: 'DE' },
  });

  assert.equal(station?.id, 'aq-42-pm25');
  assert.equal(station?.name, 'Station A');
  assert.equal(station?.pm25, 18.3);
  assert.equal(station?.level, 'Good');
  assert.equal(station?.source.provider, 'OpenAQ');
});

test('classifies unhealthy PM2.5 values', () => {
  assert.deepEqual(classifyPm25(42), {
    level: 'Moderate',
    color: '#FFD700',
    severity: 'medium',
  });
  assert.deepEqual(classifyPm25(180), {
    level: 'Hazardous',
    color: '#8B0000',
    severity: 'critical',
  });
});

test('builds a non-failing disabled response when OpenAQ key is missing', () => {
  const response = buildOpenAqDisabledResponse();

  assert.equal(response.enabled, false);
  assert.equal(response.stations.length, 0);
  assert.equal(response.sources.openaq.status, 'disabled');
});
