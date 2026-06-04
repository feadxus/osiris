import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeCvePriority,
  normalizeEpssRecord,
  scoreCyberPriority,
} from './cyber-priority.ts';

test('normalizes EPSS score strings into numbers', () => {
  const record = normalizeEpssRecord({
    cve: 'CVE-2024-3094',
    epss: '0.850580000',
    percentile: '0.993660000',
    date: '2026-06-03',
  });

  assert.equal(record?.cve, 'CVE-2024-3094');
  assert.equal(record?.epss, 0.85058);
  assert.equal(record?.percentile, 0.99366);
});

test('scores CVE priority from EPSS, KEV and CVSS signals', () => {
  assert.equal(scoreCyberPriority({ epss: 0.85, percentile: 0.99, isKnownExploited: true, cvss: 9.8 }), 'critical');
  assert.equal(scoreCyberPriority({ epss: 0.3, percentile: 0.8, isKnownExploited: false, cvss: 7.2 }), 'high');
  assert.equal(scoreCyberPriority({ epss: 0.05, percentile: 0.4, isKnownExploited: false, cvss: 5.1 }), 'medium');
});

test('merges CVE priority metadata', () => {
  const merged = mergeCvePriority({
    cve: 'CVE-2024-3094',
    epss: { cve: 'CVE-2024-3094', epss: 0.85, percentile: 0.99, date: '2026-06-03' },
    kev: { cveID: 'CVE-2024-3094', vulnerabilityName: 'XZ Utils backdoor', dateAdded: '2024-03-29' },
    cvss: 9.8,
  });

  assert.equal(merged.id, 'CVE-2024-3094');
  assert.equal(merged.priority, 'critical');
  assert.equal(merged.epss?.probability, 0.85);
  assert.equal(merged.kev?.known_exploited, true);
});
