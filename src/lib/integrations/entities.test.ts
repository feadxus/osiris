import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGleifLeiRecord } from './entities.ts';

test('normalizes GLEIF LEI records into entity results', () => {
  const entity = normalizeGleifLeiRecord({
    id: '5493001KJTIIGC8Y1R12',
    attributes: {
      lei: '5493001KJTIIGC8Y1R12',
      entity: {
        legalName: { name: 'OPENAI OPCO, LLC' },
        legalAddress: { country: 'US', city: 'San Francisco' },
        status: 'ACTIVE',
      },
      registration: { status: 'ISSUED', initialRegistrationDate: '2024-01-01T00:00:00Z' },
    },
  });

  assert.equal(entity.id, 'gleif-5493001KJTIIGC8Y1R12');
  assert.equal(entity.name, 'OPENAI OPCO, LLC');
  assert.equal(entity.countryCode, 'US');
  assert.equal(entity.source.provider, 'GLEIF');
});
