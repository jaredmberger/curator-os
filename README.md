# CuratorOS

CuratorOS is the evidence-first, iPad-first institutional operating system behind Ocean Liner Curator.

This repository is organized so development happens in modular source files while the browser application is assembled into a clean production site artifact for deployment.

## CuratorOS suite

CuratorOS is the home application for a connected maintenance and publishing suite:

- **CuratorOS:** `https://curator.oceanliners.net/`
- **Site Health:** `https://site-health.oceanliners.net/`
- **Curator Indexer:** `https://curator-indexer.oceanliners.net/`
- **Curator Speed:** `https://speed.oceanliners.net/`
- **Page Studio:** `https://page-studio.oceanliners.net/`

The official 1.0 workflow is:

`Scan → Explain → Locate → Recommend → Repair → Publish → Verify`

1. Run Site Health, Curator Indexer, or Curator Speed.
2. Export the report from the scanner.
3. Import it into CuratorOS.
4. Review the finding, recommendation, history, and curator decision.
5. Open the affected page directly in Page Studio.
6. Edit and validate the page.
7. Create a GitHub branch and pull request through the secure publishing Worker.
8. Rerun the relevant scanner and verify that the finding is resolved.

The scanners remain independent engines. CuratorOS is their operating surface and review system. The integration is intentionally honest: launch, export, and import rather than claiming silent synchronization.

The stable exchange formats and compatibility rules are documented in [`docs/curatoros-suite-contract.md`](docs/curatoros-suite-contract.md).

## Open CuratorOS

After GitHub Pages is enabled with **GitHub Actions** as the source, every merge to `main` deploys the application automatically.

Primary application address:

`https://curator.oceanliners.net/`

GitHub Pages fallback address:

`https://jaredmberger.github.io/curator-os/`

Both addresses open CuratorOS directly at the site root. The deployment workflow can also be run manually from the Actions tab.

### Open it on iPad or iPhone

1. Open `https://curator.oceanliners.net/` in Safari.
2. Tap the Share button.
3. Choose **Add to Home Screen**.
4. Launch **CuratorOS** from the Home Screen like an app.

CuratorOS stores its catalog and workflow state locally in that browser. Use catalog exports, snapshots, and finding-workflow exports regularly, especially before clearing Safari website data or changing devices.

## Core 1.0 capabilities

CuratorOS 1.0 includes:

- structured authoring for ships, builders, shipping lines, sources, reference objects, and photos or media
- evidence relationships, review queues, advanced search, and publication previews
- imported findings from Site Health, Curator Indexer, and Curator Speed
- new, persistent, verified, and regressed scan history
- durable Open, Handled, Verified, and Regressed curator decisions with notes
- contextual repair handoff into Page Studio
- secure branch, commit, and pull-request creation through the Page Studio Worker
- unified site-assurance readiness
- coverage and content-gap intelligence
- local snapshots, guarded import, full export, and recovery backups

## Custom domain

The application is intended to run at:

`https://curator.oceanliners.net/`

The repository-side deployment publishes the application at the hostname root rather than redirecting to `/preview/`.

Cloudflare DNS should contain a `CNAME` record named `curator` pointing to `jaredmberger.github.io`. GitHub Pages should list `curator.oceanliners.net` as the custom domain with HTTPS enabled when available.

For private access, place the hostname behind Cloudflare Access and require your chosen identity provider or one-time PIN. Cloudflare DNS and Access settings are account-side configuration; they are not changed by repository commits.

## Deployment layout

Source files remain organized under `preview/` and `src/`. The Pages workflow creates a temporary production artifact where:

- `preview/index.html` becomes the deployed root `index.html`
- the application entry file, manifest, icon, and service worker are published at the root
- `src/` is copied beside them
- deployment-only asset paths are rewritten for root hosting

The generated `_site` directory is a deployment artifact and is not committed to the repository.

## Local use and release checks

1. Run `npm start` from the repository root.
2. Open `http://localhost:4173/preview/`.

Before a release, run:

```bash
npm run check
```

The manual release gate is documented in [`docs/release-1.0-acceptance.md`](docs/release-1.0-acceptance.md). Release notes are maintained in [`RELEASE_NOTES.md`](RELEASE_NOTES.md).

## Protecting catalog data

Canonical records are stored in the browser. Use **Export** and **Snapshot** regularly. CuratorOS creates both a local recovery snapshot and a downloadable full backup before replacing the database through import.

Finding decisions and notes have their own export and import workflow so maintenance history can be backed up independently.

Browser storage is device- and browser-specific. Clearing site data can remove the local catalog and workflow state unless backups have been exported.

## Synchronization architecture

CuratorOS remains local-first. The provider-neutral synchronization boundary, conflict states, recovery guarantees, and implementation sequence are defined in [`docs/synchronization-contract.md`](docs/synchronization-contract.md).

The current interface uses a local mock sync provider. It does not claim authenticated cloud synchronization or silent remote deployment. The contract requires explicit authentication, visible sync state, canonical validation, recovery snapshots before replacement, and no silent last-write-wins behavior.

## Release model

- `main` — stable releases
- feature and release branches — isolated development
- pull requests — review and acceptance before release
- `1.0.0-rc.1` — current release candidate
- `1.0.0` — final official release after the acceptance checklist passes

## Current milestone

**CuratorOS 1.0 Release Candidate 1 — iPad-First Site Operations**

The complete operational loop now exists in the browser. The remaining work before the official 1.0 designation is acceptance testing, any stabilization fixes discovered during that testing, deployment verification, and the final version change to `1.0.0`.
