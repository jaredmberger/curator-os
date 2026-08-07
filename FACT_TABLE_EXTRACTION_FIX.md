# Ship Guide Fact Table Extraction Fix

CuratorOS ship-guide extraction must treat the Ocean Liner Curator Key Facts block as a first-class structured source.

Ocean Liner Curator ship guides implement the fact table with semantic `div` elements rather than native `<table>` markup:

- `.facts[role="table"]`
- `.fact-row[role="row"]`
- `.fact-label[role="cell"]`
- `.fact-value[role="cell"]`

The v0.4.1 compatibility parser exposes those rows to the existing extraction collector without changing the public page markup.

Special handling includes:

- Operator (as built) → original operator
- Owner / later operator → operator history
- Completed → completed date
- Primary route (typical) → routes
- Length / Beam → separate length and beam facts
- Service period → service notes/context
- Type → service notes/context
- Nickname → alternate names

The canonical save path still requires human review before writing to permanent Project Records.
