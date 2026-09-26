import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('restore script includes disposable-target safeguards', async () => {
  const source = await readFile(new URL('../scripts/restore-recovery-backup.mjs', import.meta.url), 'utf8');
  assert.match(source, /--confirm-disposable/);
  assert.match(source, /--production-namespace-id/);
  assert.match(source, /--namespace-id/);
  assert.match(source, /--remote/);
  assert.match(source, /project-records/);
  assert.match(source, /research-state/);
  assert.match(source, /Post-write verification failed/);
});
