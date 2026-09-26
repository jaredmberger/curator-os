import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/recovery-export.js';

function mockStore(values) {
  return {
    async get(key, type) {
      assert.equal(type, 'text');
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    }
  };
}

test('recovery export includes both durable records and integrity metadata', async () => {
  const response = await onRequestGet({
    env: {
      CURATOROS_RECORDS: mockStore({
        'project-records': JSON.stringify({
          records: [{ id: 'ship-1', name: 'Example' }],
          version: 7,
          updatedAt: '2026-09-26T00:00:00.000Z'
        }),
        'research-state': JSON.stringify({
          state: { notebooks: [] },
          version: 4,
          updatedAt: '2026-09-26T00:00:00.000Z'
        })
      })
    }
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /^attachment; filename="curatoros-recovery-/);

  const body = await response.json();
  assert.equal(body.format, 'curatoros-kv-recovery');
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.summary.projectRecordCount, 1);
  assert.equal(body.summary.projectRecordsVersion, 7);
  assert.equal(body.summary.researchStateVersion, 4);
  assert.equal(body.integrity.algorithm, 'SHA-256');
  assert.match(body.integrity.dataSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(body.data['project-records'].records[0], { id: 'ship-1', name: 'Example' });
});

test('recovery export refuses an incomplete durable store', async () => {
  const response = await onRequestGet({
    env: {
      CURATOROS_RECORDS: mockStore({
        'project-records': JSON.stringify({ records: [], version: 1 })
      })
    }
  });

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual(body.missingKeys, ['research-state']);
});

test('recovery export refuses malformed durable data', async () => {
  const response = await onRequestGet({
    env: {
      CURATOROS_RECORDS: mockStore({
        'project-records': JSON.stringify({ records: 'not-an-array' }),
        'research-state': JSON.stringify({ state: {}, version: 1 })
      })
    }
  });

  assert.equal(response.status, 500);
  const body = await response.json();
  assert.match(body.error, /records array/);
});
