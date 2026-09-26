import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-recovery-backup.mjs <backup.json>');
  process.exit(2);
}

let backup;
try {
  backup = JSON.parse(await readFile(file, 'utf8'));
} catch (error) {
  fail(`Could not read valid JSON: ${error.message}`);
}

if (backup.format !== 'curatoros-kv-recovery') fail('Unexpected backup format.');
if (backup.schemaVersion !== 1) fail(`Unsupported schemaVersion: ${backup.schemaVersion}`);
if (!backup.data || typeof backup.data !== 'object') fail('Backup data object is missing.');

const projectRecords = backup.data['project-records'];
const researchState = backup.data['research-state'];

if (!projectRecords || !Array.isArray(projectRecords.records)) {
  fail('project-records is missing or does not contain a records array.');
}
if (
  !researchState ||
  !researchState.state ||
  typeof researchState.state !== 'object' ||
  Array.isArray(researchState.state)
) {
  fail('research-state is missing or does not contain a state object.');
}

const expected = backup.integrity?.dataSha256;
if (!expected || backup.integrity?.algorithm !== 'SHA-256') {
  fail('SHA-256 integrity metadata is missing.');
}

const actual = createHash('sha256').update(JSON.stringify(backup.data)).digest('hex');
if (actual !== expected) fail('SHA-256 integrity check failed.');

console.log('CuratorOS recovery backup is valid.');
console.log(`Exported: ${backup.exportedAt || 'unknown'}`);
console.log(`Project Records: ${projectRecords.records.length} records, version ${Number(projectRecords.version || 0)}`);
console.log(`Research State: version ${Number(researchState.version || 0)}`);
console.log(`SHA-256: ${actual}`);

function fail(message) {
  console.error(`Invalid CuratorOS recovery backup: ${message}`);
  process.exit(1);
}
