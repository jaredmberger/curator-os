# Disaster Recovery and Reconstruction Runbook

## Purpose

This document defines how to reconstruct Ocean Liner Curator and CuratorOS after loss of a local working copy, a failed deployment, accidental deletion of a service, or loss of a device.

The recovery design assumes:

- **GitHub `main` is the canonical source for application and website code.**
- Old local/iCloud website folders are archives, not authoritative production sources.
- Cloudflare account state contains infrastructure configuration that GitHub cannot fully preserve.
- Secret values must never be committed to GitHub.
- Cloudflare KV contains durable operational and institutional data that source control alone cannot recreate.

The goal is not merely to restore pages. Recovery is complete only when the public site, CuratorOS, durable data, specialist services, monitoring, publishing paths, and scheduled jobs have been verified.

---

## Recovery classes

| Layer | Recovery source | Status |
| --- | --- | --- |
| Public website source and assets | `jaredmberger/Ocean-Liner-Curator` | GitHub authoritative |
| CuratorOS application source | `jaredmberger/curator-os` | GitHub authoritative |
| Specialist CuratorOS services | Individual GitHub repositories | GitHub authoritative |
| GitHub Actions workflows | Repository `.github/workflows` | GitHub authoritative |
| Worker/Pages code configuration | `wrangler.toml`, `wrangler.jsonc`, READMEs | Mostly GitHub reconstructible |
| Cloudflare KV namespace IDs | Most service Wrangler files | Mostly recorded in GitHub |
| Cloudflare KV data | Cloudflare KV | **Not backed up by GitHub** |
| Cloudflare secrets | Cloudflare encrypted secrets | **Not recoverable from GitHub** |
| Cloudflare custom domains / Access policies | Cloudflare account configuration | **Not recoverable from GitHub alone** |
| GitHub Pages account-side settings | GitHub repository settings | Partially represented by workflows/CNAME |
| Local/iCloud working copies | Secondary/offline copies | Non-authoritative |

---

## Canonical repository inventory

### Public site

- Repository: `jaredmberger/Ocean-Liner-Curator`
- Production source branch: `main`
- Cloudflare config: `wrangler.jsonc`
- Worker name: `ocean-liner-curator-git`
- Static asset directory: repository root
- Production public identities to verify:
  - `https://www.oceanliners.net/`
  - `https://oceanliners.net/`
- Important automated build/reconciliation workflows include:
  - device archive
  - ship sitemap synchronization
  - CuratorOS integrity manifest
  - search/Pagefind build
  - builder intelligence
  - operator intelligence
  - shipyard intelligence
  - class/sister intelligence
  - era/service intelligence
  - archive-gap intelligence

### CuratorOS and services

| Repository | Service / host | Deployment model |
| --- | --- | --- |
| `curator-os` | `curator.oceanliners.net` | Cloudflare Pages + Pages Functions |
| `curator-tools` | `tools.oceanliners.net` | Static/GitHub Pages-compatible |
| `content-opportunity` | `content.oceanliners.net` | Cloudflare Worker |
| `site-health` | `site-health.oceanliners.net` | Cloudflare Worker |
| `curator-integrity` | `integrity.oceanliners.net` | Cloudflare Worker |
| `speed` | `speed.oceanliners.net` | Cloudflare Worker + static assets |
| `search-intelligence` | `search-intelligence.oceanliners.net` | Cloudflare Worker |
| `link-map` | `link-map.oceanliners.net` | Cloudflare Pages + Pages Function |
| `curator-indexer` | `curator-indexer.oceanliners.net` | Cloudflare Worker |
| `page-studio` | `page-studio.oceanliners.net` | Static frontend + Cloudflare Worker publisher/loader |
| `analytics` | `analytics.oceanliners.net` | Cloudflare Worker |
| `errors` | `errors.oceanliners.net` | Cloudflare Worker |
| `research-capture` | Research Capture service | Cloudflare Worker |
| `verify` | `verify.oceanlinercurator.com` | Cloudflare Worker |
| `ops` | `ops.oceanlinercurator.com` | Cloudflare Worker |
| `launch` | `launch.oceanliners.net` | Static launcher / GitHub Pages-compatible |

If a hostname differs from the table during recovery, trust the live Cloudflare/GitHub account configuration and update this document after verification.

---

## Durable Cloudflare KV inventory

These namespace identifiers are committed in current repository configuration and can be used to verify that a reconstructed Worker points to the intended store.

| Binding | Namespace ID | Primary service |
| --- | --- | --- |
| `SITE_HEALTH_INTEGRATION_CACHE` | `594632c804d045b589724f48dc72c08e` | Site Health |
| `CURATOR_ERROR_RECORDS` | `447306da3a754b44830d2ac8608322c0` | Error Bus / shared monitoring |
| `CURATOR_INDEXER_RECORDS` | `cdc9a84c8b364dcd9361d670c8db26b5` | Indexer |
| `CURATOR_SPEED_RECORDS` | `6de4740a91b94f9a945ce12a9f5a2208` | Speed |
| `LINK_MAP_CACHE` | `9d3f33cd6d0940cfaf548649af119dfe` | Link Map |
| `CURATOR_INTEGRITY_RECORDS` | `77798f0b676c4257bdd03fc656532c3f` | Integrity |
| `SEARCH_INTELLIGENCE_RECORDS` | `b469b6c1bfc04b48b00c5d887bd16594` | Search Intelligence |
| `OPPORTUNITY_STATE` | `afce711ea6844278b0d7fe059c739be2` | Content Opportunity |
| `CURATOR_ANALYTICS_RECORDS` | `159b868253094d3db41c4698a636fc4c` | Analytics |
| `CURATOR_RESEARCH_CAPTURES` | `b43b1006793f48d2a38bbd091dbdc8ef` | Research Capture |
| `CURATOR_VERIFY_RECORDS` | `bf7fb04aa1754f729acd62595bf21004` | Verify |
| `CURATOR_OPS_RECORDS` | `747c318b62fa479aa486130011d5670d` | Ops |

### CuratorOS institutional KV

CuratorOS Pages Functions require the binding:

`CURATOROS_RECORDS`

It stores at minimum:

- `project-records` — canonical Project Records corpus
- `research-state` — durable research lifecycle/state

The namespace ID is not currently committed in the CuratorOS repository. During a recovery drill, obtain it from the Cloudflare Pages project binding and record/verify it in the private infrastructure inventory. Do **not** replace the production namespace with a new empty namespace unless data loss has already occurred and restoration from backup is intentional.

### KV recovery rule

A Worker can be recreated from GitHub while still appearing technically healthy against an empty KV namespace. Therefore:

> **Successful deployment is not proof of successful data recovery.**

For every stateful service, verify both the binding and expected retained data after redeployment.

---

## Scheduled work recorded in source

Current Wrangler configuration records these schedules:

| Service | Schedule |
| --- | --- |
| Site Health | `27 * * * *` |
| Curator Indexer | `7 * * * *` |
| Curator Integrity | `17 * * * *` |
| Speed | `37 * * * *` |
| Search Intelligence | `17 7 * * *` |
| Error Bus public-site watchdog | `* * * * *` |
| Error Bus housekeeping | `47 * * * *` |
| Curator Ops | `*/5 * * * *` |

GitHub Actions also provides scheduled or event-driven work. Verify active workflow schedules in GitHub Actions rather than assuming this document is exhaustive.

---

## Secret registry

Secret **names** may be documented. Secret **values must not be stored here or anywhere in the repository.**

Known recovery-sensitive secrets include:

| Secret name | Service | Purpose |
| --- | --- | --- |
| `AUDIT_TOKEN` | Site Health, Curator Indexer and related protected audit paths | Authenticates protected audit operations |
| `GITHUB_TOKEN` | Page Studio Worker | Fine-grained GitHub publishing credential |
| `CAPTURE_TOKEN` | Research Capture | Optional authenticated capture writes |
| `VERIFY_WRITE_KEY` | Verify | Authenticated verification writes |
| `OPS_WRITE_KEY` | Ops | Authenticated operational writes |
| `GITHUB_OPS_TOKEN` | Ops | Authenticated GitHub API access for browser-search monitoring |

Additional secrets may exist in current Cloudflare project settings even when not listed here. During recovery, inspect each Cloudflare Worker/Pages project's **Variables and Secrets** configuration before declaring the service restored.

### Page Studio GitHub token permissions

The fine-grained Page Studio token should be limited to the Ocean Liner Curator repository and require only:

- Contents: read and write
- Pull requests: read and write
- Metadata: read

Never place this credential in frontend JavaScript, `config.js`, Wrangler configuration, GitHub source, or browser storage.

---

## Cloudflare account-side state that must be preserved separately

GitHub source control cannot by itself restore:

1. Custom-domain assignments.
2. DNS records and zone configuration.
3. Cloudflare Access applications and policies.
4. Encrypted Worker/Pages secrets.
5. Existing KV contents.
6. Pages project environment bindings that are not committed.
7. Account-level deployment/project linkage.
8. Any manually configured environment variables not represented in repository configuration.

These are infrastructure dependencies, not source-code dependencies.

---

# Reconstruction procedure

## Phase 0 — Protect evidence before changing anything

1. Do not delete surviving Cloudflare projects, KV namespaces, DNS records, or Access policies.
2. Do not create replacement KV namespaces merely because a Worker is missing.
3. Record the currently surviving state of:
   - GitHub repositories and `main` branch heads
   - Cloudflare Workers and Pages projects
   - KV namespaces and bindings
   - custom domains
   - Access applications
   - secrets by **name only**
4. If the incident involves a bad deployment rather than total loss, prefer rollback or redeploy of a known Git commit before reconstruction.

## Phase 1 — Recover source control

1. Sign in to GitHub.
2. Confirm access to all repositories in the canonical inventory.
3. Verify `main` exists for each repository.
4. Download or clone fresh copies from GitHub.
5. Do **not** overwrite GitHub from an old iCloud/local folder.
6. For Ocean Liner Curator, run the repository's normal validation/build workflows before production deployment.
7. Confirm generated device feeds, sitemaps, search artifacts, and integrity manifests are internally consistent.

At this point, GitHub should once again be the only authoritative source tree.

## Phase 2 — Restore the public site

1. Reconnect/import `jaredmberger/Ocean-Liner-Curator` to the intended Cloudflare Worker/static-assets deployment.
2. Verify `wrangler.jsonc`:
   - Worker: `ocean-liner-curator-git`
   - static assets: repository root
3. Restore the production custom-domain mappings for `oceanliners.net` and/or `www.oceanliners.net` as currently intended.
4. Verify DNS.
5. Deploy current `main`.
6. Test:
   - homepage
   - Ship Archive
   - representative ship guide
   - static images
   - shared navigation
   - homepage search
   - standalone search
   - Pagefind assets
   - `/api/device/curatoros-integrity.json`

Do not proceed on the assumption that HTTP 200 alone proves the public site is healthy.

## Phase 3 — Restore CuratorOS institutional storage first

Before restoring the CuratorOS user interface, identify the existing production `CURATOROS_RECORDS` KV namespace.

Verify that it still contains:

- `project-records`
- `research-state`

Then reconnect the Cloudflare Pages project:

- repository: `jaredmberger/curator-os`
- production branch: `main`
- build command: `bash scripts/build-cloudflare-pages.sh`
- build output: `dist-pages`
- root directory: repository root / blank
- Pages Functions binding: `CURATOROS_RECORDS`
- custom domain: `curator.oceanliners.net`
- Cloudflare Access protection: enabled as intended

Deploy and verify:

1. CuratorOS opens.
2. Project Records reports permanent storage connected.
3. Existing Project Records load.
4. Research State loads.
5. A second browser/device sees the same durable data.
6. No interface reports a cache-only state as permanent.

## Phase 4 — Restore the shared monitoring core

Restore these before convenience/editorial tools because other services depend on them for operational truth:

1. Error Bus
2. Verify
3. Ops

For each:

- reconnect the repository
- verify Wrangler entrypoint
- attach the **existing** KV namespace(s)
- recreate required secrets
- attach custom domain
- deploy
- verify runtime/status endpoint
- confirm retained historical state where expected

For Ops specifically, verify both:

- `CURATOR_OPS_RECORDS`
- shared `CURATOR_ERROR_RECORDS`

Then confirm the monitoring self-test passes before relying on Ops health conclusions.

## Phase 5 — Restore specialist observation services

Recommended order:

1. Site Health
2. Curator Indexer
3. Curator Integrity
4. Speed
5. Link Map
6. Search Intelligence
7. Analytics

For each service:

1. Deploy from `main`.
2. Confirm the expected KV binding.
3. Restore required secret names/values from the approved secret source.
4. Confirm custom domain.
5. Confirm scheduled trigger where applicable.
6. Open its status/runtime endpoint.
7. Confirm it can communicate with upstream/downstream CuratorOS services.
8. Confirm Ops sees a fresh successful observation.

## Phase 6 — Restore intelligence/editorial services

Restore:

1. Curator Intelligence / Tools
2. Content Opportunity
3. Research Capture
4. Page Studio
5. Launch

### Content Opportunity

Verify `OPPORTUNITY_STATE` points to the retained namespace before deployment so workflow history and fallback snapshots are not silently replaced by an empty store.

### Research Capture

Verify:

- `CURATOR_RESEARCH_CAPTURES`
- `CAPTURE_TOKEN` if protection is enabled
- Safari/iOS Shortcut uses the current endpoint and matching token

Confirm recent historical captures remain visible.

### Page Studio

Restore frontend and Worker separately.

Worker configuration:

- entrypoint: `worker/src/index.js`
- Worker name: `page-studio-loader`
- allowed production origin includes `https://page-studio.oceanliners.net`
- allowed repository remains limited to Ocean Liner Curator
- base branch: `main`
- encrypted `GITHUB_TOKEN` restored
- Cloudflare Access protections restored where used

Validation:

1. Load an existing OceanLiners.net page.
2. Enter edit mode.
3. Validate without publishing.
4. Use a harmless test change or disposable branch to prove the publisher can create a branch/PR.
5. Never test recovery by writing directly to `main`.

---

# Final recovery acceptance test

Recovery is complete only after all applicable items pass.

## Public site

- [ ] Homepage returns correct Ocean Liner Curator content.
- [ ] Representative ship guides load.
- [ ] Images and styles load normally.
- [ ] Ship Archive works.
- [ ] Homepage search works.
- [ ] Standalone search works.
- [ ] Pagefind assets are present.
- [ ] Random Ship works and uses the current archive.
- [ ] Device archive feed is current.
- [ ] Ship sitemap is current.
- [ ] CuratorOS integrity manifest is current.

## CuratorOS

- [ ] CuratorOS loads from `curator.oceanliners.net`.
- [ ] Cloudflare Access behaves as intended.
- [ ] Project Records reports permanent store connected.
- [ ] Existing Project Records are present.
- [ ] Research State is present.
- [ ] Data persists across reload and another device/browser.

## Monitoring

- [ ] Error Bus status endpoint works.
- [ ] Verify can perform an authenticated test.
- [ ] Ops status works.
- [ ] Ops self-test passes.
- [ ] Ops sees expected service inventory.
- [ ] Scheduled heartbeats become fresh.
- [ ] No false green state is caused by empty replacement KV stores.

## Specialist tools

- [ ] Site Health works.
- [ ] Indexer works.
- [ ] Integrity works.
- [ ] Speed works.
- [ ] Link Map API/UI works.
- [ ] Search Intelligence has a fresh snapshot.
- [ ] Analytics responds with current data.
- [ ] Content Opportunity retains workflow state.
- [ ] Research Capture retains historical captures.
- [ ] Page Studio can safely create a test PR.
- [ ] Launch points to current production destinations.

## GitHub

- [ ] `main` is authoritative for all production repositories.
- [ ] GitHub Actions are enabled.
- [ ] Critical workflows pass.
- [ ] No recovery edits were made from stale local/iCloud files.

---

# Offline and backup policy

## Source snapshot

Periodically download a fresh GitHub ZIP or clone of the authoritative repositories and store it outside GitHub.

A source snapshot is useful protection against repository access loss, but it is **not** a complete CuratorOS backup because it does not contain:

- secret values
- Cloudflare Access policy state
- DNS/custom-domain configuration
- KV data

## KV data

The highest-value non-GitHub data is the content of durable KV stores, especially:

1. `CURATOROS_RECORDS`
2. `CURATOR_RESEARCH_CAPTURES`
3. `OPPORTUNITY_STATE`
4. `CURATOR_ERROR_RECORDS`
5. `CURATOR_OPS_RECORDS`
6. Search/analytics/integrity/indexer/speed retained records where historical continuity matters

A future recovery-hardening task should define a repeatable export/snapshot process for these stores and test restoration into disposable namespaces.

## Credentials

Maintain a secure credential source outside the repositories. The disaster-recovery record should preserve:

- which credentials exist
- which account owns them
- what service uses them
- minimum required permissions
- how to rotate/recreate them

It should never contain the secret itself.

---

# Recovery drill cadence

Run a non-destructive recovery review after major infrastructure changes and periodically thereafter.

A useful drill consists of:

1. Download fresh repository snapshots.
2. Compare this inventory with live GitHub repositories.
3. Compare recorded Worker/Pages bindings with Cloudflare.
4. Confirm all required secret **names** are known.
5. Confirm the production KV namespace identities.
6. Verify at least one durable-data export can be read.
7. Confirm a clean source checkout passes validation without relying on old local files.
8. Record any new dependency discovered during the drill.

The runbook should be updated in the same pull request as any infrastructure change that materially alters recovery.

---

## Recovery principle

**GitHub restores the machinery. Cloudflare restores the environment and durable state. Neither alone is a complete backup.**

The canonical reconstruction path is:

`GitHub main → Cloudflare bindings/secrets/domains → retained KV data → deploy → independent verification`
