# Research-to-publication closeout (operator checklist)

The Historical Research Agent proposes leads; no automated model extraction constitutes independent verification.

## Repeatable procedure
1. Allow scheduled Historical Research Agent runs to generate dossiers and evidence JSON; verify a complete private R2 manifest.
2. In the CuratorOS Historical Research Library, open an evidence register. Check original sources and compare each claim with its existing ship guide.
3. Save separate decisions in the **Editorial claim review** form. Use `verified` only for claims supported by independently checked sources and a written rationale. Split compound claims editorially; do not mark a partly supported compound claim wholly verified.
4. Use **Prepare reviewed research package**. It includes only qualifying claims saved in CuratorOS; copy it into a ChatGPT conversation for source-grounded guide-diff drafting. **This action never edits the guide.**
5. With explicit editorial direction, prepare a **draft** GitHub PR against the appropriate ship guide. Keep unsupported facts out. Human reviews and merges the PR after CI.
6. In the claim's **Guide incorporation / publication record**, enter the PR URL. Use **Check GitHub PR** to view GitHub's current merged/open status. This fetch is read-only and does **not** automatically change the incorporation ledger.
7. Record PR merge only once GitHub confirms it. Only record **Deployment confirmed** after separately inspecting the production URL and confirming the relevant text is live; GitHub merge alone does not establish production deployment.
8. For public **Research Provenance**, write a carefully curated, limited-scope page with institutional attribution `Ocean Liner Curator Editorial Review`, the historical question, direct source links, comparative evaluation, the guide PR and explicit limitations. Keep private dossiers, KV records and reviewer identities private. Publish via a separate human-reviewed PR.

## Pilot record: Monarch of Bermuda
- Dossier run: `39155321347`
- Register: `ss-monarch-of-bermuda.evidence.json`
- Guide PR: `https://github.com/jaredmberger/Ocean-Liner-Curator/pull/594`
- Public provenance pilot PR: `https://github.com/jaredmberger/Ocean-Liner-Curator/pull/595`
- Specific verified claim: 24 March 1947 fire date
- Unresolved claims: original machinery manufacturers; exact 15 August 1950 emigrant departure date
- **Do not auto-backfill** reviews or deployments based solely on conversational history.

## Remaining gaps
- GitHub PR status is checked on demand, not continuously; unauthenticated public GitHub metadata may be rate limited.
- Public production URL validation and deployment attribution are manual.
- No autonomous PR creation/merge, and no automatic write-back of ChatGPT decisions into CuratorOS: saving a review in CuratorOS remains necessary.
- R2 storage integrity shows that an archive has not changed, *not* that its historical contents are true.
- Private CuratorOS pages and API endpoints must remain protected by Cloudflare Access.

## Provenance page structure
Title: `[Ship]: [specific question]`
Attribution: `Ocean Liner Curator Editorial Review`
Sections: **The question**, **Evidence examined**, **Editorial conclusion and guide revision**, **Limits of this review**.
Every factual assertion should be backed by an inspectable citation or explicitly marked provisional. Never imply that a claim-specific review covers the entire guide.
