# Historical Research Library — R2 reader (Phase 1)

This is a **read-only** research archive browser in CuratorOS at `/research-library.html`. It is not a guide editor, editorial verifier, canonical-record importer, or replacement for the research ledger.

## Deployment configuration

1. In the production Cloudflare Pages project serving `curator.oceanliners.net`, add an **R2 bucket binding** named exactly `RESEARCH_DOSSIERS_R2`.
2. Bind it to the existing **private research archive bucket** used by `Ocean-Liner-Curator/scripts/archive-research-to-r2.py` (the bucket selected by `R2_RESEARCH_BUCKET` in that repo's GitHub workflow).
3. Ensure the Cloudflare Access protection for the CuratorOS application also protects the `/research-library.html` page and `/api/research-library` route. **Do not deploy this route publicly until access policy is verified.** A bucket binding grants server-side read capability; it does not make the HTTP endpoint private automatically.
4. Redeploy CuratorOS, then open the Historical Research Library from Research lifecycle navigation. An absent binding produces HTTP 503, not a fallback to public storage.

There is **no separate public bucket endpoint**, GitHub-to-CuratorOS POST, or R2 S3 access key in the browser. Never add R2 secrets to Pages public environment variables or front-end code.

## API

- `GET /api/research-library` — paged list of archived run manifests; optional `cursor`.
- `GET /api/research-library?run=123` — validated manifest for a run.
- `GET /api/research-library?run=123&file=ss-example.md` — archive text only when declared in that run's manifest and verified against its recorded byte count and SHA-256.

All research content is labeled **unverified pending editorial review**. No mutation methods are implemented. Per-claim editorial decisions, integration with existing CuratorOS research states, and approved guide revision PRs are deliberately deferred to later phases.

## Validation

Run `node --test tests/research-library.test.mjs` or `npm run check`.

## Operational limitations

The index paginates by run prefix rather than scanning all objects at once; the browser can load additional pages. The file viewer is text-only; JSON evidence registers are displayed as source text in Phase 1. If an archive manifest is absent or invalid, the UI reports it rather than manufacturing research claims. The Copy for ChatGPT review button copies **unverified** content for a human-reviewed conversation; it does not verify or publish claims.
