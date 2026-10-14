# Stewardship finding navigation: verified boundary

Inspected production Worker entrypoint in `jaredmberger/ops`: `src/ops.js` → `src/fleet-diagnostics.js` → `src/recovery-home.js` → `src/diagnostics.js` → (operational-state chain). The `src/operational-state.js` GET route `/operational-state` renders a findings table from the authoritative operational-state snapshot.

The current table renders finding names, roles, severity, and messages but has **no stable finding-ID anchors**. We therefore navigate all Curator Ops review candidates to the **fixed authoritative view**, `https://ops.oceanlinercurator.com/operational-state`, not to a fabricated per-finding URL. This may require a human to locate the matching signal by its ID or context.

No user-provided finding IDs or URLs are inserted into links, no operations are triggered, and no changes are made to Curator Ops or OceanLiners.net. Any future per-finding deep links should first add a reviewed stable anchor contract to the authoritative Ops interface and test it there before enabling consumer links.
