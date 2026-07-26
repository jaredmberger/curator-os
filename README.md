# CuratorOS

CuratorOS is the evidence-first institutional operating system behind Ocean Liner Curator.

This repository is organized so development happens in modular source files while Cloudflare deployment remains a single generated Worker.

## Hosted application

After GitHub Pages is enabled for this repository, the browser application is deployed automatically from `main` and is available at:

`https://jaredmberger.github.io/curator-os/preview/`

The deployment workflow can also be run manually from the Actions tab.

## Local use

1. Run `npm start` from the repository root.
2. Open `http://localhost:4173/preview/`.

CuratorOS is now a functional local-first alpha product designed for direct iPad use. It supports canonical creation and editing for ships, builders, shipping lines, sources, reference objects, photos and media; relationship exploration; publication review; advanced search; JSON publication exports; generated HTML page packages; browser persistence; snapshots; guarded import and restore; and first-use storage diagnostics.

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

**CuratorOS 5.3 alpha — Functional Local-First Product**

The complete curator loop is available inside the browser: create canonical records, link evidence and relationships, review publication health, preview output, and download validated publication packages without editing raw JSON or requiring a desktop build step.
