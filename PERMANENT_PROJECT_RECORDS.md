# Permanent Project Records

CuratorOS treats Project Records as the permanent internal knowledge corpus. Browser localStorage is only a cache.

## Cloudflare Pages requirement

The Pages Function at `functions/api/project-records.js` expects a KV namespace binding named:

`CURATOROS_RECORDS`

Create a Cloudflare KV namespace for CuratorOS Project Records and bind it to the Pages project under **Settings → Functions → KV namespace bindings** using that exact variable name.

The API stores one versioned corpus document under the key `project-records`.

## Behavior

- `GET /api/project-records` loads the permanent corpus.
- `PUT /api/project-records` replaces the permanent corpus with the approved current records and increments a version number.
- Project Records UI loads the permanent corpus when opened and refreshes the local cache.
- Project import writes to permanent storage before reloading the UI.
- Record edits save to permanent storage before being treated as successful.
- Export remains optional backup/interchange and is not the database.

## Migration

After deployment and KV binding, import the current authoritative CuratorOS project export once. That initializes the permanent store. Future approved edits/imports are saved directly by CuratorOS.

## Safety note

The browser cache remains useful if the network is unavailable. The Project Records UI reports whether it is connected to the permanent store, using cache, or has a pending unsynced save.
