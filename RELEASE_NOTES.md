# CuratorOS 1.0 Release Notes

## CuratorOS 1.0 Release Candidate 1

CuratorOS 1.0 establishes an iPad-first operating system for maintaining OceanLiners.net through an evidence-first workflow:

`Scan → Explain → Locate → Recommend → Repair → Publish → Verify`

### Operational findings

- Imports findings from Site Health, Curator Indexer, and Curator Speed.
- Explains what was found, why it matters, and what to do next.
- Tracks new, persistent, verified, and regressed findings across scans.
- Supports durable Open, Handled, Verified, and Regressed decisions.
- Stores curator notes and timestamps locally.
- Exports and restores the finding workflow independently from the catalog.

### Repair and publishing

- Opens affected OceanLiners.net pages directly in Page Studio.
- Carries finding context, recommendations, checked links, and suggested replacements.
- Page Studio loads the page, supports visual and code editing, validates the result, and prepares GitHub metadata.
- Secure Worker-based publishing creates a branch, commit, and pull request without exposing GitHub credentials in browser code.

### Unified site assurance

- Presents Site Health, Curator Indexer, and Curator Speed in one operational panel.
- Marks imported evidence as current, aging, stale, or missing.
- Summarizes high-priority open work, regressions, handled findings, and verified fixes.
- Provides direct Run and Import actions while remaining explicit that scanners still use export/import handoffs.

### Coverage intelligence

- Compares canonical CuratorOS records with an imported Curator Indexer snapshot.
- Identifies canonical ships without indexed guides.
- Identifies indexed guides without matching canonical ship records.
- Surfaces builder-page and shipping-line coverage gaps.
- Performs local heuristic matching and labels the comparison basis honestly.

### Catalog and research functions

- Creates and edits structured records for ships, builders, shipping lines, sources, reference objects, and photos or media.
- Supports evidence relationships, review queues, advanced search, publication previews, and generated page packages.
- Provides guarded catalog import, full export, local snapshots, and recovery backups.

### Release boundaries

CuratorOS 1.0 remains local-first. It does not claim:

- silent background synchronization
- automatic scanner synchronization
- automatic merging to production
- automatic acceptance of suggested repairs
- perfect semantic matching between canonical records and indexed pages

The curator remains responsible for reviewing evidence, approving edits, inspecting pull requests, and deciding what reaches production.

### Release-candidate verification

The manual and automated release gate is documented in [`docs/release-1.0-acceptance.md`](docs/release-1.0-acceptance.md). The final `1.0.0` designation should follow successful completion of that checklist.
