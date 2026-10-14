# Ship Guide Stewardship — Phase 1 (offline only)

This is the first ship-specific observation contract. It is **not a live CuratorOS ship-auditing dashboard**, and it does not certify any guide as historically correct.

## Inputs already present in Ocean Liner Curator

- `sitemaps/sitemap-ships.xml`: authoritative enumerated ship-guide inventory.
- `node tools/search/internal-link-audit.mjs --json > internal-link-audit.json`: static incoming/contextual links from repository HTML. It excludes script-injected links and is not a live broken-link verdict.
- `python3 scripts/historical-consistency-monitor.py`: conservative Key Facts chronology audit. Its CSV uses `level,issue,subject,evidence`; some findings reference *same-hull identity groups* instead of individual ship slugs, so the CSV requires a separately reviewed identity mapping before per-guide import. **This PR does not ingest the CSV or silently attribute group findings to a ship.**

Run against a locally checked-out Ocean Liner Curator repository:

```sh
cd Ocean-Liner-Curator
node tools/search/internal-link-audit.mjs --json > internal-link-audit.json
node /path/to/curator-os/tools/stewardship/build-ship-guide-inventory.mjs \
  --sitemap sitemaps/sitemap-ships.xml \
  --links internal-link-audit.json \
  --output ship-stewardship.json
```

The generated JSON contains a separate row for each listed ship with its canonical source URL, observed/static-link status, unverified candidates, and explicit `unknown` or `not-assessed` fields. It is not fetched from the browser or published to CuratorOS; do not treat its `observedAt` as proof the archive was recently audited if inputs are old. The export is local and does not affect the site or public index.

## Next gated steps

1. Confirm the source sitemap's inventory count and make sure no non-guide index entries are included.
2. Record provenance per input artifact (source Git SHA plus audit execution timestamp). Version the contract before production use.
3. Add conservative, explicit multi-guide identity mapping for same-hull chronology results; preserve distinctions such as two *George Washington* operational careers and separate *Orontes* vessels.
4. Build a **read-only CuratorOS importer and per-ship inspection UI**, with source freshness and incomplete checks visible. No auto-remediation, editing, or automatic publishing.
5. Add other checks only after verifying their actual schemas: canonical URLs, image metadata, citation availability, and redirects.

This is a tooling-only PR. No live API, Cloudflare bindings, worker variables, changes to ship guides, SEO changes, or editorial assertions.
