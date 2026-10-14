# Ship Stewardship validated snapshot publishing

This release adds a **manual, main-branch-only, opt-in** publish job downstream of the already-validated ship archive export. The job requires a GitHub Environment named `stewardship-snapshot-publishing`; configure required reviewers for it. It does not run on PRs, and the workflow input `publish_verified_snapshot` defaults to false.

It uses a dedicated Cloudflare API token stored as an Environment secret `STEWARDSHIP_SNAPSHOT_KV_WRITE_TOKEN` with narrowly scoped **Workers KV Storage Edit** permission for only the intended Cloudflare account (and namespace if Cloudflare API-token scoping supports it). Do **not** use a global API key, an all-account token, a public HTML endpoint or a Pages deployment token. Supply GitHub Environment variables `STEWARDSHIP_CF_ACCOUNT_ID` and `STEWARDSHIP_SHIP_KV_NAMESPACE_ID`, with the namespace ID corresponding to a **dedicated ship-stewardship KV namespace**, not CuratorOS records or the operational/error bus stores.

Before enabling operator reads, provision the `STEWARDSHIP_SHIP_SNAPSHOTS` production Pages KV binding to this exact namespace. Only after a successful published and independently verified snapshot, switch `STEWARDSHIP_SHIP_READ_ENABLED` from absent/false to true. Existing signed Stewardship Access JWT restrictions remain mandatory. The API reads a fixed key `verified:ship-stewardship:v1`, rejects exports older than seven days, and never accepts writes.

Rollback: set `STEWARDSHIP_SHIP_READ_ENABLED=false`; do not delete historical export artifacts as part of a rollback. A missing credential, binding, publication or snapshot must remain `unavailable`—never `healthy`.

Once configured, launch the **Ship Stewardship Archive Export** workflow manually on `main` with `publish_verified_snapshot=true`, review its summary, and open `/ship-inspector.html` → **Load protected archive snapshot**. A passing workflow validates source revision, inventory counts, schema, and explicit unverified status. No ship guides are edited or published.
