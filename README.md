# CuratorOS

CuratorOS is the evidence-first, iPad-first institutional research operating system behind Ocean Liner Curator.

Its purpose is to transform accumulated research into connected, interrogable, evidence-aware institutional knowledge while keeping the concrete historical record at the center of the system.

> Every meaningful function of CuratorOS should help Ocean Liner Curator know, understand, preserve, or act intelligently on its knowledge.

## Production architecture

- **Source control:** GitHub — `jaredmberger/curator-os`
- **Production host:** Cloudflare Pages
- **Production application:** `https://curator.oceanliners.net/`
- **Server-side API:** Cloudflare Pages Functions
- **Canonical Project Records:** Cloudflare KV binding `CURATOROS_RECORDS`
- **Durable research state:** Cloudflare KV via `/api/research-state`

GitHub Pages and the former standalone CuratorOS Worker are retired production paths.

Cloudflare Pages builds from `main` with:

```text
Build command: bash scripts/build-cloudflare-pages.sh
Build output:  dist-pages
Root directory: repository root (leave the Cloudflare field blank)
```

## Product model

CuratorOS is record-first.

**Real-world entity → canonical record → structured facts → evidence → relationships → interpretation**

For Ship Records, the record represents the actual ship. Evidence explains why individual facts are trusted; it does not replace the record.

The live product surface is organized around four areas.

### Records

- Project Records
- canonical Ship Record inspector/editor
- field-level evidence
- Research History
- Record Activity and before/after change detail

### Build & maintain the corpus

- Extract Knowledge
- Build Corpus
- Site / Knowledge Sync
- Entity Resolution

### Understand the corpus

- Knowledge Graph
- Corpus Intelligence
- Evidence & Conflicts

### Research lifecycle

- Research Desk
- Research Queue
- Investigation Notebook
- Conclusion Review
- Knowledge Promotion
- Incorporation Review

The research lifecycle is deliberately gated:

`Discovery → question → investigation → supported conclusion → routing → review → promotion → incorporation`

No interpretive conclusion silently becomes a canonical historical fact.

## Permanence

Project Records are permanently stored in Cloudflare KV. Browser storage is a working cache, not the institutional source of truth.

Research state is also persisted through Cloudflare KV, including research decisions, Investigation Notebooks, supported conclusions, review decisions, promotion packages, incorporation history, relationship proposals, publication notes, and canonical Record Activity.

This allows the institutional research history to survive browser cache clearing and continue across devices and browsers.

## Ship Record history

A canonical Ship Record now keeps three concepts separate:

1. **Historical Record** — what CuratorOS currently knows about the ship.
2. **Research History** — how that knowledge was investigated, interpreted, reviewed, and incorporated.
3. **Record Activity** — how the canonical record itself changed, including inspectable before/after detail when snapshots are available.

## Related Ocean Liner Curator tools

CuratorOS sits within a wider suite of purpose-built tools:

- `https://site-health.oceanliners.net/`
- `https://integrity.oceanliners.net/`
- `https://search-intelligence.oceanliners.net/`
- `https://curator-indexer.oceanliners.net/`
- `https://speed.oceanliners.net/`
- `https://page-studio.oceanliners.net/`

These remain independent tools. CuratorOS should only claim an integration where an actual data handoff or shared workflow exists.

## iPad and iPhone

CuratorOS is designed to remain fully usable from Safari on iPad and iPhone.

To install it as a Home Screen web app:

1. Open `https://curator.oceanliners.net/` in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Launch CuratorOS from the Home Screen.

Desktop access is supported but is not required for ordinary CuratorOS work.

## Development and release checks

Local preview:

```bash
npm start
```

Then open `http://localhost:4173/preview/`.

Current validation gate:

```bash
npm run check
```

Stable Keel validates the active application shell and core database behavior on pull requests and `main`. Production deployment itself is owned by Cloudflare Pages rather than GitHub Actions.

## Release model

- `main` — production source branch
- feature branches — isolated development
- pull requests — review before production
- `preview/version.js` — canonical user-visible CuratorOS version

The v0.9 series is the v1.0 readiness phase: simplify the product surface, strengthen permanence and provenance, improve cross-navigation and auditability, and remove assumptions inherited from earlier CuratorOS prototypes.

A 1.0 designation should represent the current institutional research system—not the retired dashboard/workflow architecture that preceded it.
