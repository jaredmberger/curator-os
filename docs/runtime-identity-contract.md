# CuratorOS Runtime Identity Contract v1

Every application runtime in the CuratorOS service fleet should expose:

`GET /api/runtime`

The endpoint is read-only, uncached, and intended for deployment identity, drift detection, diagnostics, and disaster recovery.

## Stable fields

Every v1 response uses the same top-level keys:

- `ok` — boolean runtime response state
- `contractVersion` — `1`
- `service` — human-readable service name
- `repository` — canonical GitHub repository in `owner/name` form
- `productionBranch` — canonical production branch; currently `main`
- `version` — application/service version string
- `commit` — Git commit deployed by the current build when the platform exposes or stamps it
- `cloudflareDeploymentId` — Cloudflare Worker version/deployment ID when available; `null` on Pages
- `runtime` — `cloudflare-workers` or `cloudflare-pages`
- `cloudflareVersion` — additive platform metadata with `id`, `tag`, and `timestamp`
- `build` — additive build metadata including commit, branch, build UUID when available, and source
- `observedAt` — ISO-8601 time the runtime response was generated

Additional service-specific fields are allowed. Stable v1 fields must not disappear or change meaning without a new contract version and compatibility period.

## Cloudflare Workers

Workers use deploy-time generated build metadata and the `CF_VERSION_METADATA` binding.

For Workers:

- `commit` must identify the deployed Git revision.
- `cloudflareDeploymentId` must be the Cloudflare Worker version ID.
- `runtime` is `cloudflare-workers`.

The existing fleet may also retain richer `build` and `cloudflareVersion` objects for compatibility.

## Cloudflare Pages Functions

Pages provides Git build identity but does not expose the same Worker version ID.

For Pages:

- `commit` is `CF_PAGES_COMMIT_SHA`.
- `build.branch` is `CF_PAGES_BRANCH`.
- `deploymentUrl` may expose `CF_PAGES_URL` as an additive field.
- `cloudflareDeploymentId` is explicitly `null`.
- `runtime` is `cloudflare-pages`.

A null Pages deployment ID is not an unknown runtime. The Git commit and Pages deployment context are the available deployment truth.

## Static-only surfaces

Pure static asset surfaces without an application runtime do not need a synthetic `/api/runtime` endpoint.

In particular, the public OceanLiners.net deployment is intentionally not wrapped in an application Worker solely to satisfy this contract. Public-site deployment truth remains covered by the existing GitHub-to-Cloudflare deployment checks, availability monitoring, and repository identity.

The same rule applies to other truly static launcher/tool surfaces unless they acquire an application runtime.

## Consumers

Curator Ops validates contract v1 before treating a runtime as identified.

Worker validation remains strict: a Worker without a deployment/version ID is incomplete.

Pages validation accepts `cloudflareDeploymentId: null` because the platform does not expose the equivalent Worker version identifier.

## Security

`/api/runtime` must never expose secret values, tokens, account IDs that are not already operational metadata, request headers, or private stored records.

The endpoint is deployment identity, not a debug dump.
