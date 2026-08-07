# Durable Project Records

CuratorOS treats Project Records as the permanent internal knowledge corpus. Browser `localStorage` is only a working cache and offline fallback.

## Production architecture

CuratorOS is hosted by **Cloudflare Pages** from the canonical GitHub repository:

`jaredmberger/curator-os`

Cloudflare Pages serves the application and runs the Pages Function at:

`/api/project-records`

That function uses a KV namespace binding named:

`CURATOROS_RECORDS`

The API stores one versioned corpus document under the KV key:

`project-records`

Production flow:

`GitHub source repository`
→ `Cloudflare Pages build`
→ `curator.oceanliners.net`
→ `/api/project-records` Pages Function
→ `CURATOROS_RECORDS` KV

## Cloudflare Pages configuration

Create/connect a Cloudflare Pages project to `jaredmberger/curator-os`.

Use:

- Production branch: `main`
- Build command: `bash scripts/build-cloudflare-pages.sh`
- Build output directory: `dist-pages`
- Root directory: repository root

The build publishes the complete CuratorOS application, shared `/src/` assets, and the generated Link Map dataset into one Pages artifact.

### KV binding

Bind the CuratorOS records KV namespace to the Pages project using the exact variable name:

`CURATOROS_RECORDS`

This is a **Cloudflare Pages Functions KV binding**.

### Custom domain

Attach:

`curator.oceanliners.net`

The repository-root `functions/` directory is deployed by Cloudflare Pages as Pages Functions, so `functions/api/project-records.js` becomes the live same-origin endpoint at `/api/project-records`.

### Access protection

Project Records are internal institutional data and the API supports writes. Protect `curator.oceanliners.net` with Cloudflare Access (or equivalent Cloudflare authentication) so anonymous visitors cannot read or replace the corpus.

Do not expose the write endpoint publicly.

## API behavior

### Load corpus

`GET /api/project-records`

Returns the durable records array plus version and timestamp.

### Save corpus

`PUT /api/project-records`

Replaces the approved corpus, increments the storage version, and writes the result to KV.

The CuratorOS browser client must not mark a save as permanent unless the remote write succeeds and can be verified.

## Browser-cache behavior

The browser cache remains useful for resilience and offline work, but it is not the source of truth.

CuratorOS reports one of these states:

- **Permanent store connected** — data came from KV.
- **Using local cache** — the remote API is unavailable or not yet configured.
- **Permanent save pending** — the browser contains a newer attempted save that did not reach KV.

## First initialization

After the Pages deployment, KV binding, custom domain, and Access protection are confirmed:

1. Open CuratorOS Project Records.
2. Confirm the interface reports **Permanent store connected**.
3. Import the current authoritative CuratorOS project export once, or create the first canonical record.
4. Confirm the KV namespace contains the `project-records` key.
5. Reload CuratorOS in another browser/device.
6. Confirm the same records return from KV.

At that point, the institutional corpus is durable independently of any single iPad, browser profile, or local cache.
