import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOverpassInfrastructureQuery,
  normalizeOverpassElement,
} from './infrastructure-context.ts';

test('builds bounded Overpass infrastructure query', () => {
  const query = buildOverpassInfrastructureQuery({
    south: 52.45,
    west: 13.3,
    north: 52.6,
    east: 13.55,
  });

  assert.match(query, /power/);
  assert.match(query, /out center 50/);
});

test('normalizes Overpass node infrastructure element', () => {
  const item = normalizeOverpassElement({
    type: 'node',
    id: 123,
    lat: 52.5,
    lon: 13.4,
    tags: { power: 'plant', name: 'Plant A' },
  });

  assert.equal(item?.id, 'osm-node-123');
  assert.equal(item?.type, 'power_plant');
  assert.equal(item?.name, 'Plant A');
  assert.equal(item?.source.provider, 'OpenStreetMap/Overpass');
});
