# Main dashboard monitoring connection

The dashboard reads `/api/ops-health` on its own origin. The Pages Function uses
an explicitly configured Cloudflare service binding to the existing `ops` Worker.
Direct browser calls to the Ops hostname were redirected to Cloudflare Access
sign-in because they omitted credentials.

## Production setup

1. In Cloudflare, open **Workers & Pages → curator-os → Settings → Bindings**.
2. Add a **Service binding** named **CURATOR_OPS**, targeting Worker **ops**
   in its production environment. Keep the existing bindings intact.
3. Save, then deploy the merged main branch (or retry the production deployment
   if the merge deployed before the binding was saved). Binding changes require
   a new deployment.
4. Reload CuratorOS. The three cards should show their actual Ops states and last
   check times. Tap **Refresh status** to fetch their latest stored results.
5. Verify `/api/ops-health` returns JSON with three `available: true` checks.
   Availability only describes retrieval: degraded/persistent states are valid
   monitoring results and must be investigated through the linked Ops pages.

Configure the equivalent binding separately for a preview environment only if
that preview is intended to read production summaries. Until configured, it
shows **Setup needed**. Do not add Access bypass rules or browser-side secrets.

Reference: https://developers.cloudflare.com/pages/functions/bindings/#service-bindings

## Contract and limits

- GET only; three hard-coded read routes. Caller URLs, cookies, authorization
  headers, bodies, and methods are never passed through.
- Returns only availability, normalized state, timestamp, staleness, and a fixed
  diagnostic code. Full Ops snapshots, infrastructure details, and errors stay
  in Ops. The endpoint has no permissive CORS header and uses `no-store`.
- Each upstream read is bounded to five seconds, including body parsing. One
  failed check does not hide the other two results.
- Snapshots older than 20 minutes are marked **Stale**, consistent with Ops'
  operational-state policy. Missing/invalid timestamps cannot display healthy.
- The browser refreshes every minute while visible, on return to the app, and
  on demand. Refresh reads stored results; it does not trigger checks, dispatch
  workflows, write KV, or create/reconcile Error Bus incidents.
- Ops remains responsible for scheduled checks, browser-run freshness and
  incident lifecycle. The binding does not change its public Access policy.

## Recovery and verification

Restore the Ops Worker before verifying this optional dashboard integration,
then recreate the Pages service binding and redeploy. CuratorOS records and
research workflows do not depend on this status connection.

Run `npm run check`; it includes `tests/ops-health.test.mjs`. Tests cover fixed
routes, credential isolation, method rejection, per-check failures, redirects,
invalid responses, timestamp freshness, timeouts, and display state transitions.
Live verification still requires the production binding and deployment.
