# Direct Google Search Console daily feed

The Search Visibility dashboard can now be populated from Google's **official Search Console API** without depending on the ChatGPT Data Bloo connection.

## Before the first run
1. In a Google Cloud project you control, enable **Google Search Console API** and create a **service account** with a JSON key. Protect the private key.
2. In Google Search Console, open property `sc-domain:oceanliners.net`, go to **Settings → Users and permissions**, and grant the service account's `client_email` address access as a user (property access may require owner approval). The service account can retrieve only sites to which it was granted access.
3. In **GitHub → jaredmberger/curator-os → Settings → Secrets and variables → Actions**, add repository secret `GSC_SERVICE_ACCOUNT_JSON` with the complete service-account key JSON.
4. Add **GitHub Actions** repository secret `SEARCH_VISIBILITY_INGEST_TOKEN` with the same secret value you already set on the Cloudflare Pages `curator-os` project. Cloudflare and GitHub do not share secrets automatically. Never paste either secret into issues, chat messages, or commits.
5. After merge, open **Actions → Sync Search Visibility → Run workflow**. Confirm the action log reports dates and number of rows (but no private key). Open `https://curator.oceanliners.net/search-visibility.html` with the stewardship **review** token to verify real ingested metrics.

## Operation
The workflow runs daily at 13:42 UTC and fetches 35 days of daily Search Console Web performance through the official API, ending **three UTC calendar days ago** to avoid most incomplete recent data. It sends the results to the same Cloudflare Pages API and KV key created by PR #295. Existing rows are upserted by date. It does not overwrite rows when the API returns none.

The Cloudflare ingest token authorizes writes only; the existing review token authorizes dashboard reads. The job uses `webmasters.readonly` and never changes Google data or Ocean Liner Curator content. No automatic indexing requests or penalty determinations.

**Important operational distinctions:** Search Console performance reports can be delayed and are sometimes revised after publication. The workflow only provides daily Google Web search metrics; it does not replace URL Inspection or provide a complete inventory of indexed pages. Configure least-privilege property access and rotate credentials if exposed.

## Troubleshooting
- HTTP 401 from Google: check the service-account key JSON.
- HTTP 403 from Google: check that Google Search Console property access was granted to the service-account email.
- HTTP 401 from CuratorOS: the GitHub Actions and Cloudflare ingestion token values do not match.
- No rows: inspect GSC property selection and lag; sync fails rather than pretending a fresh update.
- GitHub scheduled jobs can be delayed. Check latest data date in the native dashboard.
