# CuratorOS v1.0.0-rc.1

This release candidate freezes the CuratorOS v1.0 feature set. From this point until v1.0.0, changes should be limited to defects, reliability issues, accessibility/usability regressions, deployment problems, and documentation corrections.

## Acceptance gate

Before promoting this release candidate to v1.0.0, confirm the following against production at `https://curator.oceanliners.net/`.

### Production and permanence

- The visible version badge reports `v1.0.0-rc.1`.
- Cloudflare Pages serves the production application from `main`.
- Institutional State reports both Project Records and Research State as durable/connected under normal conditions.
- A canonical Ship Record edit persists after reload.
- Research state persists across a second browser or device with no prior CuratorOS local cache.
- Clearing browser site data does not erase durable Project Records or durable research history.
- Recheck stores successfully returns the app to healthy state after a temporary connectivity failure.

### Canonical records

- Project Records opens by default.
- A Ship Record opens directly from supported deep links.
- Core facts remain readable and editable on iPad Safari.
- Maiden voyage and other fact-table-derived fields remain present after extraction/import.
- Creating, editing, and deleting a record behaves as expected.
- Record Activity logs new canonical edits.
- Record Change Detail shows correct read-only before → after values.

### Research lifecycle

Confirm the complete path using at least one real or disposable research item:

`Discovery → Research Queue → Investigation Notebook → Supported conclusion → Conclusion Review → Knowledge Promotion → Incorporation Review`

- Investigation Notebook state persists durably.
- Routed conclusions open at the exact relevant review item.
- Accepted conclusions can become promotion packages.
- Incorporation remains an explicit human action rather than an automatic corpus mutation.
- Ship Research History links back to exact underlying research items where applicable.

### Integrity and provenance

- Research History and Record Activity remain visibly distinct.
- Orphaned research references are surfaced by Institutional State rather than silently ignored.
- Cache-only or unverified states are labeled as degraded and are not described as permanent.
- Evidence/conflict information remains attached to the correct records.
- No retired legacy CuratorOS workspace appears in the production sidebar or active navigation.

### iPad-first usability

- Sidebar scrolls normally without becoming trapped.
- Long Ship Records remain navigable without layout breakage.
- Before/after change details stack readably on narrow screens.
- Primary research and record workflows require no desktop-only interaction.
- A normal Safari refresh receives the current deployment without requiring routine website-data clearing.

### Automated gate

- `npm run check` passes.
- Stable Keel passes on the release-candidate PR.
- Cloudflare Pages production deployment succeeds after merge.

## Promotion rule

If the release candidate passes this acceptance gate without a blocking defect, promote the same feature set to `v1.0.0`.

Do not use the release-candidate period to add new features. A newly desired capability belongs after v1.0 unless it is required to correct a release-blocking defect.
