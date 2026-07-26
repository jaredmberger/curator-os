# CuratorOS Suite Integration Contract

CuratorOS is the home application for the Ocean Liner Curator maintenance suite.

## Applications

| Application | Address | Responsibility |
|---|---|---|
| CuratorOS | `https://curator.oceanliners.net/` | Review findings, load catalogs, import scan results, track progress, and build content |
| Site Health | `https://site-health.oceanliners.net/` | Crawl pages, check source and internal links, classify failures, and export findings |
| Curator Indexer | `https://curator-indexer.oceanliners.net/` | Build the canonical site index and knowledge graph |

## Curator workflow

`Scan → Explain → Locate → Recommend → Resolve`

1. Launch Site Health from CuratorOS.
2. Run an audit and export `findings.json`.
3. Return to CuratorOS and use **Import Scan Results**.
4. Launch Curator Indexer from CuratorOS.
5. Build and download `site-index.json`.
6. Return to CuratorOS and import the index as intelligence data.
7. Review, resolve, or convert findings into content work.

## Stable exchange files

### `findings.json`

Schema identifier:

`https://oceanliners.net/curatoros/findings.schema.json`

Current schema version: `1.0`

Produced by Site Health and consumed by CuratorOS.

### `site-index.json`

Schema identifier:

`https://oceanliners.net/curatoros/site-index.schema.json`

Current schema version: `1.0`

Produced by Curator Indexer and consumed by CuratorOS.

### Catalog and registry data

CuratorOS catalog files are authoritative editorial data. They are loaded through **Load Catalog**, not **Import Scan Results**. A valid catalog containing no health findings is a successful catalog import and must not be described as an error.

## Compatibility rules

- Producers must include `schema`, `schemaVersion`, `generator`, and `generatedAt`.
- Consumers must validate the schema identifier before modifying local data.
- Consumers may accept additive fields in the same major schema version.
- Unknown fields must be preserved where practical.
- A breaking structural change requires a new major schema version.
- Import must be explicit; no scanner silently overwrites CuratorOS data.
- CuratorOS remains local-first and creates recovery data before replacement imports.

## Product boundary

The scanners are independent engines. CuratorOS is their operating surface and review system. The current honest integration is launch, export, and import; direct authenticated handoff may be added later without changing the exchange contracts.
