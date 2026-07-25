# CuratorOS

CuratorOS is the evidence-first institutional operating system behind Ocean Liner Curator.

This repository is organized so development happens in modular source files while Cloudflare deployment remains a single generated Worker.

## Hosted preview

After GitHub Pages is enabled for this repository, the preview is deployed automatically from `main` and is available at:

`https://jaredmberger.github.io/curator-os/preview/`

The deployment workflow can also be run manually from the Actions tab.

## Local developer preview

1. Run `npm start` from the repository root.
2. Open `http://localhost:4173/preview/`.

The preview includes the Collection Catalog, canonical browser persistence, search and filters, record inspection, inline editing, undo/redo, record creation, structured authoring dialogs, local snapshots, and guarded import/restore flows.

## Synchronization architecture

CuratorOS remains local-first. The provider-neutral synchronization boundary, conflict states, recovery guarantees, and implementation sequence are defined in [`docs/synchronization-contract.md`](docs/synchronization-contract.md).

The contract requires explicit authentication, visible sync state, canonical validation, recovery snapshots before replacement, and no silent last-write-wins behavior.

## Release model

- `main` — stable releases
- feature branches — isolated development
- pull requests — review and acceptance before release

## Current milestone

**CuratorOS 5.3 alpha — Local-first Hosted Developer Preview**

The current milestone provides a browser application designed for direct iPad use, with canonical authoring, portable backups, recovery snapshots, and an explicit architectural path toward optional authenticated synchronization while preserving Stable Keel validation and tests.
