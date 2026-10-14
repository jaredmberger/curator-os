# Stewardship source integrations — contract-first gate

This PR **does not connect** Site Health or Curator Integrity. Both remain unconnected/unknown until their authoritative live response formats, credentials, timestamps, and intended coverage are separately verified.

## Candidate contract v1 (not a claim about either upstream service)

```json
{
  "contractVersion": 1,
  "source": "site-health",
  "generatedAt": "2026-10-14T03:55:00Z",
  "state": "degraded",
  "freshness": "fresh",
  "coverage": {
    "reportedChecks": 10,
    "listedChecks": 9,
    "completeness": "source-specific-only"
  },
  "findings": [{"id": "check-1", "severity": "attention"}]
}
```

Alternate source ID: `curator-integrity`. The payload is a proposed **sanitized adapter output**, not an external endpoint schema. Identifiers must be stable, bounded and non-sensitive. No messages, evidence content, raw URLs, credentials, private diagnostics, or mutable remediation actions may be forwarded.

## Before any live reads

1. Inspect authenticated, authoritative Site Health and Curator Integrity contracts and exact coverage semantics. Record absent fields as unknown; never invent counts.
2. Implement source-specific **server-side** adapters using fixed service bindings or explicitly approved protected URLs. No user-controlled destinations, no browser direct access to internal services.
3. Validate signed operator authorization, least-privilege bindings, finite response size, timestamps and explicit schema versions; fail closed on any mismatch.
4. Compare reported versus listed counts without interpreting partial coverage as success.
5. Stage offline and denied/authorized tests before any production enablement, with an independent feature switch per source.
6. Add dashboard rows only after these gates pass. Do not blend operational status with historical accuracy or automatically edit OceanLiners.net.

## Operational boundaries

This work adds a pure function and tests only. No HTTP, deployment variables, routes, dashboards, navigation links, automation, publishing, or Cloudflare changes. Existing Stewardship Ops endpoint stays as-is.
