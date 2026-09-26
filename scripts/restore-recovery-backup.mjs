import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
if (!args.backup || !args.namespaceId) {
  usage();
  process.exit(2);
}
if (!/^[a-f0-9]{32}$/i.test(args.namespaceId)) {
  fail('Namespace ID must be a 32-character hexadecimal Cloudflare KV namespace ID.');
}
if (!args.confirmDisposable) {
  fail('Refusing remote write. Re-run with --confirm-disposable after verifying this is a disposable/test KV namespace.');
}
if (args.productionNamespaceId && args.namespaceId.toLowerCase() === args.productionNamespaceId.toLowerCase()) {
  fail('Target namespace matches the supplied production namespace ID. Refusing restore.');
}

const backup = JSON.parse(await readFile(args.backup, 'utf8'));
validateBackup(backup);

const expected = backup.integrity.dataSha256;
const actual = createHash('sha256').update(JSON.stringify(backup.data)).digest('hex');
if (actual !== expected) fail('Backup SHA-256 integrity check failed.');

const workdir = await mkdtemp(join(tmpdir(), 'curatoros-kv-restore-'));
try {
  const projectPath = join(workdir, 'project-records.json');
  const researchPath = join(workdir, 'research-state.json');

  await writeFile(projectPath, JSON.stringify(backup.data['project-records']));
  await writeFile(researchPath, JSON.stringify(backup.data['research-state']));

  console.log('Target namespace:', args.namespaceId);
  console.log('Backup exported:', backup.exportedAt);
  console.log('Project Records:', backup.data['project-records'].records.length);
  console.log('Research State version:', Number(backup.data['research-state'].version || 0));

  put('project-records', projectPath);
  put('research-state', researchPath);

  const restoredProject = get('project-records');
  const restoredResearch = get('research-state');

  if (restoredProject !== JSON.stringify(backup.data['project-records'])) {
    fail('Post-write verification failed for project-records.');
  }
  if (restoredResearch !== JSON.stringify(backup.data['research-state'])) {
    fail('Post-write verification failed for research-state.');
  }

  console.log('Disposable KV restore verified successfully.');
  console.log('Both durable CuratorOS keys match the backup exactly.');
} finally {
  await rm(workdir, { recursive: true, force: true });
}

function put(key, path) {
  run([
    'wrangler', 'kv', 'key', 'put', key,
    '--path', path,
    '--namespace-id', args.namespaceId,
    '--remote'
  ], `write ${key}`);
}

function get(key) {
  return run([
    'wrangler', 'kv', 'key', 'get', key,
    '--namespace-id', args.namespaceId,
    '--remote',
    '--text'
  ], `read back ${key}`, true).trim();
}

function run(wranglerArgs, label, capture = false) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['--yes', ...wranglerArgs], {
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit'
  });
  if (result.error) fail(`Could not ${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`Wrangler failed while attempting to ${label}.`);
  return capture ? result.stdout : '';
}

function validateBackup(backup) {
  if (backup.format !== 'curatoros-kv-recovery') fail('Unexpected backup format.');
  if (backup.schemaVersion !== 1) fail(`Unsupported schemaVersion: ${backup.schemaVersion}`);
  if (!backup.data || typeof backup.data !== 'object') fail('Backup data object is missing.');
  if (!backup.integrity || backup.integrity.algorithm !== 'SHA-256' || !backup.integrity.dataSha256) {
    fail('SHA-256 integrity metadata is missing.');
  }

  const projectRecords = backup.data['project-records'];
  const researchState = backup.data['research-state'];

  if (!projectRecords || !Array.isArray(projectRecords.records)) {
    fail('project-records is missing or invalid.');
  }
  if (!researchState || !researchState.state || typeof researchState.state !== 'object' || Array.isArray(researchState.state)) {
    fail('research-state is missing or invalid.');
  }
}

function parseArgs(argv) {
  const result = { backup: null, namespaceId: null, productionNamespaceId: null, confirmDisposable: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--backup') result.backup = argv[++i];
    else if (arg === '--namespace-id') result.namespaceId = argv[++i];
    else if (arg === '--production-namespace-id') result.productionNamespaceId = argv[++i];
    else if (arg === '--confirm-disposable') result.confirmDisposable = true;
    else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

function usage() {
  console.log(`Usage:
  node scripts/restore-recovery-backup.mjs \\
    --backup /path/to/curatoros-recovery.json \\
    --namespace-id <DISPOSABLE_KV_NAMESPACE_ID> \\
    [--production-namespace-id <PRODUCTION_KV_NAMESPACE_ID>] \\
    --confirm-disposable

This command writes remotely to the explicitly supplied Cloudflare KV namespace.
It validates the backup first, writes only project-records and research-state,
then reads both keys back and requires exact byte-equivalent JSON before success.`);
}

function fail(message) {
  console.error(`CuratorOS restore aborted: ${message}`);
  process.exit(1);
}
