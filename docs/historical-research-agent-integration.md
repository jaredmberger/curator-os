# Historical Research Agent: CuratorOS read-only intake pilot

The application now includes a self-contained research evidence viewer at `/research-agent-review.html`.

1. In Ocean-Liner-Curator, run Historical Research Agent and download the `historical-research-dossiers` artifact.
2. Extract its ZIP; open CuratorOS `/research-agent-review.html` through the existing protected CuratorOS hostname.
3. Select one or more `*.evidence.json` files using the file picker; filter and inspect the claims and linked sources.
4. Compare against the adjacent Markdown dossier before accepting any claim.

This is **client-side read-only import**, not automatic synchronization. No selected files, claims, statuses, or editorial decisions are sent to any server or persisted. No canonical records are changed. The existing CuratorOS research-state and Cloudflare KV interfaces remain untouched.

The repository is public and the Cloudflare Pages build deploys these static application assets. This page **must not** contain embedded research data or credentials. Existing hostname-level access protections must be verified independently; a `noindex` tag is not authentication.

Next phase, after validating usability and access controls: design a server-side import path into durable `CURATOROS_RECORDS` or existing research-state storage with explicit authenticated ingestion, stable claim IDs, deduplication, evidence validation and auditable human editorial decisions. This pilot does not solve artifact expiry on its own.

CuratorOS is currently in a release-candidate stabilization period. This feature should be held from production unless the maintainers explicitly approve a limited-scope exception and validations pass.
