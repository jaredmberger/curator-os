# Protected ship inspection: staged integration (PR #283)

The operator-only `GET /api/stewardship-ship-snapshot` reads exactly one KV key, `verified:ship-stewardship:v1`, from the **deployment-owned** binding `STEWARDSHIP_SHIP_SNAPSHOTS`. It is disabled unless `STEWARDSHIP_SHIP_READ_ENABLED=true` and the existing cryptographically verified Stewardship operator authorization accepts the request. A missing binding, missing snapshot, malformed export, unreviewed chronology import, or export older than seven days fails closed. Neither an Access cookie by itself nor arbitrary request headers authorize access.

**Not automatically enabled or provisioned by this PR.** The GitHub Actions archive-export artifact remains private to the workflow. Nothing uploads that artifact into KV yet; setting the enable flag without separately provisioning the binding and reviewed export yields an unavailable result, not a false successful load. No secrets or KV credentials are added in GitHub Actions. Do not make the JSON a public static asset or add a public upload endpoint.

To make it fully operational, a separately reviewed operator-controlled snapshot publishing workflow must transfer the validated export to the exact KV key using narrowly scoped credentials, after confirming the archive Git revision, export provenance and rollback. Until then, use the inspector's local JSON import. The browser button only attempts the protected read and never writes anything.

The snapshot remains an **offline audit of static links and narrow chronology heuristics**. It is not proof of live site availability, historical accuracy, citation trustworthiness or image attribution, and it does not authorize edits.
