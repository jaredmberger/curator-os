import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileProjectRecordsWithArchive } from '../functions/lib/project-records-archive-sync.mjs';

const NOW = '2026-09-29T21:00:00.000Z';

function existingRecords() {
  return [
    {
      id: 'ship:rms-republic-1903',
      title: 'RMS Republic (1903)',
      type: 'ship',
      status: 'review',
      data: { pageUrl: 'https://oceanliners.net/ships/rms-republic-1903' },
      metadata: { shipSchemaVersion: 2 },
      notes: []
    },
    {
      id: 'ship:ss-george-washington',
      title: 'SS George Washington',
      type: 'ship',
      status: 'review',
      data: { pageUrl: 'https://oceanliners.net/ships/ss-george-washington' },
      metadata: { shipSchemaVersion: 2 },
      notes: []
    }
  ];
}

const archive = {
  ships: [
    {
      id: 'ss-republic-1903',
      name: 'RMS Republic (1903)',
      page: 'https://oceanliners.net/ships/ss-republic-1903',
      summary: 'Republic guide',
      year: 1903
    },
    {
      id: 'ss-george-washington',
      name: 'SS George Washington',
      page: 'https://oceanliners.net/ships/ss-george-washington',
      summary: 'American ship'
    },
    {
      id: 'ss-george-washington-ngl',
      name: 'SS George Washington',
      page: 'https://oceanliners.net/ships/ss-george-washington-ngl',
      summary: 'North German Lloyd ship'
    },
    {
      id: 'rms-rangitiki',
      name: 'RMS Rangitiki',
      page: 'https://oceanliners.net/ships/rms-rangitiki',
      summary: 'New Zealand Shipping Company liner',
      year: 1929
    },
    {
      id: 'tall-ships-guide',
      name: 'Tall Ships',
      page: 'https://oceanliners.net/ships/tall-ships',
      summary: 'Reference collection'
    }
  ]
};

test('archive sync adds missing entries and repairs an unambiguous moved canonical URL', () => {
  const result = reconcileProjectRecordsWithArchive(existingRecords(), archive, { now: NOW });

  assert.equal(result.summary.previousRecords, 2);
  assert.equal(result.summary.nextRecords, 5);
  assert.equal(result.summary.added, 3);
  assert.equal(result.summary.repaired, 1);
  assert.equal(result.summary.ambiguous, 0);

  const republic = result.records.find((record) => record.id === 'ship:rms-republic-1903');
  assert.equal(republic.data.pageUrl, 'https://oceanliners.net/ships/ss-republic-1903');
  assert.equal(republic.metadata.canonicalUrlSyncedAt, NOW);

  const rangitiki = result.records.find((record) => record.id === 'ship:rms-rangitiki');
  assert.equal(rangitiki.status, 'draft');
  assert.equal(rangitiki.metadata.extractionState, 'indexed-only');
  assert.equal(rangitiki.data.pageUrl, 'https://oceanliners.net/ships/rms-rangitiki');
  assert.equal(rangitiki.data.launchDate, undefined);

  const secondGeorge = result.records.find((record) => record.id === 'ship:ss-george-washington-ngl');
  assert.equal(secondGeorge.data.pageUrl, 'https://oceanliners.net/ships/ss-george-washington-ngl');

  const tallShips = result.records.find((record) => record.id === 'collection:tall-ships');
  assert.equal(tallShips.type, 'collection');
});

test('archive sync is idempotent once the corpus is reconciled', () => {
  const first = reconcileProjectRecordsWithArchive(existingRecords(), archive, { now: NOW });
  const second = reconcileProjectRecordsWithArchive(first.records, archive, { now: '2026-09-29T22:00:00.000Z' });

  assert.equal(second.summary.added, 0);
  assert.equal(second.summary.repaired, 0);
  assert.equal(second.summary.nextRecords, first.summary.nextRecords);
});
