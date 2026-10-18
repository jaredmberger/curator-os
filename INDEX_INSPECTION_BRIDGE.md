# Google URL Inspection in Stewardship

This is an operator-triggered, single-URL evidence viewer. CuratorOS authenticates with the existing STEWARDSHIP_REVIEW_TOKEN and calls Search Intelligence via the existing SEARCH_INTELLIGENCE_SERVICE binding.

- Only full HTTPS URLs for oceanliners.net and www.oceanliners.net are accepted.
- Each button press performs one Google URL Inspection request (and therefore consumes its API quota). No new scheduler or automatic bulk inspection is enabled.
- The response includes when the check was made, Google's last crawl timestamp if supplied, verdict, coverage, robots/indexing/fetch status, canonical evidence, and the source's diagnostic classification.
- Results are displayed for inspection only; they are **not stored**, cannot be treated as historical observations, and do not automatically enter the Stewardship case ledger.
- A failed Google inspection is not a clean result. Missing fields are unknown.
- Human review is required before concluding that a canonical choice, exclusion, or crawl status is an actual defect.

Verification after deploy: Open CuratorOS Stewardship Review with the existing review token, enter one URL, inspect, and verify the result or explicit error. Existing audit cases remain unchanged.
