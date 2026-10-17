# Watchtower Cloudflare Service binding

The public Search Intelligence hostname returned HTTP 403 to CuratorOS's server-side proxy. A Cloudflare Service binding lets the Pages Function call the existing Worker directly without public-zone WAF/Bot Fight Mode challenges.

## Required one-time Pages configuration (production)

1. Cloudflare dashboard → **Workers & Pages** → Pages project **curator-os**.
2. **Settings → Bindings → Add → Service binding**.
3. Variable name: `SEARCH_INTELLIGENCE_SERVICE`.
4. Target Worker/Service: `search-intelligence` (existing Worker in this account).
5. Save and **redeploy production** after the binding is configured.

The route `/api/search-intelligence-bridge` fails explicitly with HTTP 503 JSON if the binding is absent. It no longer falls back to the blocked public hostname. CuratorOS reads the same `/api/watchtower` contract from Search Intelligence and requires the existing stewardship review token for browser access.

After the Pages deployment, open `https://curator-os.pages.dev/search-visibility.html`, enter the review token and select Load data. Confirm Watchtower snapshots appear, and recheck the custom host. If a 502 remains, the diagnostic should now report an upstream contract or service issue rather than public-host 403.

No API credentials, WAF exceptions, indexing changes, or Google data pipeline changes are required. Keep Service binding configured in any Preview environment where this bridge is tested.
