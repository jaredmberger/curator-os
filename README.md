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

The preview includes the Collection Catalog, canonical browser persistence, search and filters, record inspection, inline editing, undo/redo, record creation, and structured authoring dialogs.

## Release model

- `main` — stable releases
- feature branches — isolated development
- pull requests — review and acceptance before release

## Current milestone

**CuratorOS 5.3 alpha — Hosted Developer Preview**

The current milestone publishes the canonical catalog and authoring workspace as a browser application that can be opened directly on an iPad while preserving Stable Keel validation and tests.
