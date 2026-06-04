import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReliefWebDisabledStatus,
  normalizeGdacsFeature,
  normalizeGdacsRssItem,
  normalizeReliefWebReport,
} from './disasters.ts';

test('normalizes a GDACS GeoJSON feature into a disaster event', () => {
  const event = normalizeGdacsFeature({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [46.567, -20.506] },
    properties: {
      eventtype: 'DR',
      eventid: 1018431,
      episodeid: 5,
      eventname: 'Madagascar-2026',
      alertlevel: 'Orange',
      description: 'Drought in Madagascar',
      fromdate: '2025-11-21T00:00:00',
      url: { report: 'https://www.gdacs.org/report.aspx' },
    },
  });

  assert.equal(event?.id, 'gdacs-DR-1018431-5');
  assert.equal(event?.title, 'Drought in Madagascar');
  assert.equal(event?.severity, 'high');
  assert.equal(event?.lat, -20.506);
  assert.equal(event?.lng, 46.567);
});

test('normalizes ReliefWeb v2 report fields', () => {
  const report = normalizeReliefWebReport({
    id: '123',
    fields: {
      title: 'Flood response update',
      url: 'https://reliefweb.int/report/example',
      date: { created: '2026-06-04T08:00:00Z' },
      country: [{ name: 'Germany', iso3: 'DEU' }],
      disaster: [{ name: 'Flood' }],
      source: [{ name: 'OCHA' }],
    },
  });

  assert.equal(report.id, 'reliefweb-123');
  assert.equal(report.country, 'Germany');
  assert.equal(report.source.provider, 'ReliefWeb');
});

test('normalizes a GDACS RSS item into a disaster event', () => {
  const event = normalizeGdacsRssItem(`
    <item>
      <title>Green flood alert in Türkiye</title>
      <link>https://www.gdacs.org/report.aspx?eventtype=FL&amp;eventid=1103920</link>
      <pubDate>Tue, 02 Jun 2026 05:45:56 GMT</pubDate>
      <geo:lat>37.2401223</geo:lat>
      <geo:long>36.4534072</geo:long>
      <gdacs:eventtype>FL</gdacs:eventtype>
      <gdacs:alertlevel>Green</gdacs:alertlevel>
      <gdacs:eventid>1103920</gdacs:eventid>
      <gdacs:episodeid>1</gdacs:episodeid>
    </item>
  `);

  assert.equal(event?.id, 'gdacs-rss-FL-1103920-1');
  assert.equal(event?.severity, 'low');
  assert.equal(event?.lat, 37.2401223);
  assert.equal(event?.lng, 36.4534072);
});

test('marks ReliefWeb disabled without approved app name', () => {
  const status = buildReliefWebDisabledStatus();

  assert.equal(status.enabled, false);
  assert.equal(status.status, 'disabled');
});
