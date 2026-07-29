# CuratorOS 1.0 Acceptance Checklist

This checklist is the release gate for the first official CuratorOS release.

CuratorOS 1.0 is ready when the complete operational loop works clearly and safely on an iPad:

`Scan → Explain → Locate → Recommend → Repair → Publish → Verify`

## 1. Application launch and navigation

- [ ] `https://curator.oceanliners.net/` opens at the application root without a redirect loop.
- [ ] CuratorOS loads in current iPad Safari in portrait and landscape orientation.
- [ ] Findings, Registry, Graph, Intelligence, Review Queue, and Developer Mode remain reachable.
- [ ] Site Health, Curator Indexer, Curator Speed, and Page Studio links open correctly.
- [ ] Add to Home Screen launches CuratorOS as expected.

## 2. Findings workflow

- [ ] Site Health CSV imports successfully.
- [ ] Curator Indexer `site-index.json` imports successfully.
- [ ] Curator Speed JSON imports successfully.
- [ ] New, persistent, verified, and regressed counts update after repeated imports.
- [ ] Finding filters and search work after importing a large report.
- [ ] Open, Handled, Verified, and Regressed decisions persist after reload.
- [ ] Curator notes persist with their timestamps.
- [ ] Finding workflow export downloads a valid JSON file.
- [ ] Finding workflow import restores states and notes.

## 3. Repair and publishing loop

- [ ] An actionable OceanLiners.net finding shows **Edit in Page Studio**.
- [ ] Page Studio opens the correct affected page automatically.
- [ ] The finding title, recommendation, checked URL, and replacement URL are carried when present.
- [ ] Page Studio pre-fills the repository path, branch name, and commit message.
- [ ] A harmless edit can be made and validated on iPad.
- [ ] Page Studio creates a GitHub branch, commit, and pull request through the Worker.
- [ ] The returned pull-request link opens correctly.
- [ ] Rerunning the relevant scanner can mark the repaired finding as verified.

## 4. Site assurance and coverage

- [ ] The Site Assurance panel distinguishes current, aging, stale, and missing reports.
- [ ] The combined readiness message matches the imported evidence.
- [ ] High-priority open findings and regressions are counted correctly.
- [ ] Coverage Intelligence accepts a current Curator Indexer export.
- [ ] Missing ship guides and unmatched indexed guides are plausible on manual review.
- [ ] Builder and shipping-line gaps are plausible on manual review.
- [ ] The interface clearly states that matching is heuristic and local-first.

## 5. Catalog safety and portability

- [ ] Full catalog export downloads successfully.
- [ ] Snapshot creates a restorable local snapshot.
- [ ] Restore replaces the catalog only after confirmation.
- [ ] Import creates a pre-import local snapshot and downloadable backup.
- [ ] A known valid Ocean Liner Curator catalog imports successfully.
- [ ] An invalid or incompatible file fails without replacing the current database.
- [ ] Clearing Safari website data is documented as destructive unless a backup exists.

## 6. Accessibility and mobile usability

- [ ] All primary controls have readable labels.
- [ ] Status and import messages are understandable without relying only on color.
- [ ] Buttons and selectors remain comfortably tappable on iPad.
- [ ] No critical controls are clipped at common tablet widths.
- [ ] Text areas and selectors remain usable when the on-screen keyboard is open.
- [ ] Focus remains visible for keyboard users.
- [ ] No horizontal page scrolling is required for the core workflow.

## 7. Repository and deployment checks

Run from the repository root with Node.js 20 or newer:

```bash
npm run check
```

This must complete:

- [ ] source validation
- [ ] automated test suite
- [ ] production build

Then confirm:

- [ ] GitHub Pages deployment succeeds from `main`.
- [ ] The custom domain serves the newly deployed build.
- [ ] The service worker does not leave the previous release stuck in cache.
- [ ] No GitHub token, Cloudflare secret, or private credential appears in browser source.

## Release decision

- [ ] All blocking items above have passed.
- [ ] Any accepted non-blocking limitation is listed in the release notes.
- [ ] Package version is changed from `1.0.0-rc.1` to `1.0.0`.
- [ ] The README identifies CuratorOS 1.0 as the current official release.
- [ ] Issue #90 is closed after the final release merge and deployment verification.
