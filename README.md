# CuratorOS

CuratorOS is the evidence-first institutional operating system behind Ocean Liner Curator.

This repository is organized so development happens in modular source files while the browser application is assembled into a clean production site artifact for deployment.

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

CuratorOS stores its catalog locally in that browser. Use **Export** and **Snapshot** regularly, especially before clearing Safari website data or changing devices.

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

## Local use

1. Run `npm start` from the repository root.
2. Open `http://localhost:4173/preview/`.

CuratorOS is a functional local-first alpha product designed for direct iPad use. It supports canonical creation and editing for ships, builders, shipping lines, sources, reference objects, photos and media; relationship exploration; publication review; advanced search; JSON publication exports; generated HTML page packages; browser persistence; snapshots; guarded import and restore; first-use storage diagnostics; and migration of OLC catalog manifests.

## Protecting catalog data

Canonical records are stored in the browser. Use **Export** and **Snapshot** regularly. CuratorOS creates both a local recovery snapshot and a downloadable full backup before replacing the database through import.

Browser storage is device- and browser-specific. Clearing site data can remove the local catalog unless a backup has been exported.

## Synchronization architecture

CuratorOS remains local-first. The provider-neutral synchronization boundary, conflict states, recovery guarantees, and implementation sequence are defined in [`docs/synchronization-contract.md`](docs/synchronization-contract.md).

The current interface uses a local mock sync provider. It does not claim authenticated cloud synchronization or silent remote deployment. The contract requires explicit authentication, visible sync state, canonical validation, recovery snapshots before replacement, and no silent last-write-wins behavior.

## Release model

- `main` — stable releases
- feature branches — isolated development
- pull requests — review and acceptance before release

## Current milestone

**CuratorOS 5.3 alpha — Root-Deployed Local-First Product**

The complete curator loop is available inside the browser: create canonical records, link evidence and relationships, review publication health, import the OLC catalog, preview output, and download validated publication packages without editing raw JSON or requiring a desktop build step.
