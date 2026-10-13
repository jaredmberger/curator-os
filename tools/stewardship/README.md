# Stewardship Mode — Phase 2 offline normalizer

This is a **pure, offline, fixture-only** prototype. It is **not** wired to CuratorOS production, Pages Functions, Ops, Site Health, cloud storage or any scheduled workflow. No dependency on API secrets.

Run independently with Node >=20:

```bash
node --test tests/stewardship-normalize.test.mjs
```

The normalizer takes an array of explicitly supplied sanitized snapshots and an injected timestamp (`now`). Each snapshot includes an explicit source-specific `max_age_ms` (not an invented common threshold), `available`, `checked_at`, and an array of source findings. It returns coverage states, sorted findings and a bounded summary. It never fetches anything, writes anything, or concludes absence means resolution. `expectedSources` makes missing coverage visible.

**Important:** Example input fields are a **proposed local fixture contract**, not verified output schemas of the existing tools. Phase 3 must verify each authoritative upstream interface and secure authentication before adding any adapter. The returned records must be treated as review candidates, not automated edits or proof of historical truth.

The application package scripts are deliberately unchanged during the release-candidate freeze. No public pages, website SEO assets, UI, deployment configuration, routes or live monitor settings are touched.
