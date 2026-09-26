# Disposable KV Restore Drill

This procedure proves that a CuratorOS recovery export can reconstruct the institutional KV data **without writing to production**.

## Safety boundary

The restore script requires:

- an explicit backup file
- an explicit Cloudflare KV namespace ID
- the literal `--confirm-disposable` flag

It writes only these two keys:

- `project-records`
- `research-state`

After writing them, it reads both keys back and compares them with the backup. A mismatch fails the drill.

For an additional guard, provide the real production namespace ID with `--production-namespace-id`. The script will refuse to run if the target namespace matches it.

## 1. Create a disposable namespace

Use Cloudflare Dashboard or Wrangler to create a new temporary namespace dedicated to the drill.

Current Wrangler syntax:

```bash
npx wrangler kv namespace create curatoros-recovery-drill
```

Record the returned namespace ID.

Do **not** attach this namespace to the production CuratorOS Pages project.

## 2. Validate the backup first

```bash
npm run recovery:validate -- /path/to/curatoros-recovery-....json
```

Only continue if validation succeeds.

## 3. Restore into the disposable namespace

```bash
npm run recovery:restore -- \
  --backup /path/to/curatoros-recovery-....json \
  --namespace-id <DISPOSABLE_NAMESPACE_ID> \
  --confirm-disposable
```

If the production namespace ID is known, use the stronger guard:

```bash
npm run recovery:restore -- \
  --backup /path/to/curatoros-recovery-....json \
  --namespace-id <DISPOSABLE_NAMESPACE_ID> \
  --production-namespace-id <PRODUCTION_NAMESPACE_ID> \
  --confirm-disposable
```

The script uses Cloudflare Wrangler remote KV operations and then reads both keys back for exact verification.

## 4. Optional application-level verification

For the strongest drill, create a temporary CuratorOS Pages deployment and bind its `CURATOROS_RECORDS` variable to the disposable namespace.

Then verify:

1. `/api/project-records` returns the expected record count and version.
2. `/api/research-state` returns the expected research-state version.
3. The CuratorOS interface shows the expected records.
4. No production hostname or production KV binding was changed.

## 5. Tear down

After the drill:

1. Remove the temporary Pages deployment, if one was created.
2. Delete the disposable KV namespace.
3. Keep the validated backup file.
4. Record the successful drill date in the recovery notes.

## Production restoration

A successful disposable drill demonstrates that the backup is usable. It does **not** authorize an automatic production restore.

A production restore should only happen after:

- confirming the production namespace is actually lost or corrupt
- preserving any surviving data
- approving the exact backup version to restore
- independently verifying the namespace target
- documenting the incident and restoration decision

The normal disaster-recovery preference remains: preserve and reconnect the surviving production namespace whenever possible.
