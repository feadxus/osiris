import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrlhausCsvLine } from './threat-intel.ts';

test('normalizes URLhaus recent CSV rows', () => {
  const item = normalizeUrlhausCsvLine(
    '"3858443","2026-06-04 08:41:14","http://125.40.94.54:57173/i","online","2026-06-04 08:41:14","malware_download","32-bit,elf,mips,Mozi","https://urlhaus.abuse.ch/url/3858443/","abuse_ch"',
  );

  assert.equal(item?.id, 'urlhaus-3858443');
  assert.equal(item?.host, '125.40.94.54');
  assert.equal(item?.status, 'online');
  assert.equal(item?.threat, 'malware_download');
  assert.equal(item?.source.provider, 'URLhaus');
});
