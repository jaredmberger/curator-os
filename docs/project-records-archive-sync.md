# Project Records ↔ Ship Archive Synchronization

CuratorOS keeps the permanent Project Records corpus separate from the public-site inventory. The **Sync ship archive** action in Project Records performs an explicit, conservative reconciliation against:

`https://oceanliners.net/api/device/archive.json`

## What sync may change

- Add a Project Record when a published archive entry has no matching permanent record.
- Repair a canonical public-page URL when one existing record and one archive entry match unambiguously.
- Create the Tall Ships archive entry as a `collection`, not a `ship`.

Newly discovered published entries are created as **draft / indexed-only** records. The archive summary and page identity are retained, but ship facts are not inferred from the archive's line, builder, or year fields. Those records remain candidates for normal page extraction and evidence review.

## What sync does not do

- It does not overwrite researched ship facts.
- It does not silently merge ambiguous same-name vessels.
- It does not run on every Project Records read.
- It does not treat an archive index row as equivalent to a fully extracted canonical Ship Record.

The endpoint is deliberately write-on-demand:

`POST /api/project-records/sync`

## Discovery candidates

A Ship Record may be marked **Discovery candidate** in the canonical Ship Record editor before a public guide exists. This flag is stored as:

```json
{
  "metadata": {
    "discoveryCandidate": true
  }
}
```

Content Opportunity may use that explicit curatorial nomination as a reason to surface the vessel even when it has not yet accumulated the normal minimum number of inbound Project Record relationships. Lack of attached sources still causes the opportunity to enter the **research** path rather than the **create** path.
