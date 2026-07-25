# CuratorOS

CuratorOS is the evidence-first institutional operating system behind Ocean Liner Curator.

This repository is organized so development happens in modular source files while Cloudflare deployment remains a single generated Worker.

## Developer preview

1. Run `npm start` from the repository root.
2. Open `http://localhost:4173/preview/`.

The preview includes the Collection Catalog, canonical browser persistence, search and filters, record inspection, inline editing, undo/redo, record creation, and structured authoring dialogs.

The same preview can be published through GitHub Pages or Cloudflare Pages for one-tap iPad access in the next deployment milestone.

## Release model

- `main` — stable releases
- feature branches — isolated development
- pull requests — review and acceptance before release

## Current milestone

**CuratorOS 5.3 alpha — Developer Preview**

The current milestone turns the canonical catalog and authoring engine into a browser-launchable application surface while preserving Stable Keel validation and tests.
