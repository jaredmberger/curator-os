# CuratorOS UI v1

**Status:** Approved design direction / implementation foundation  
**Owner:** Ocean Liner Curator LLC  
**Principle:** **The shell says CuratorOS. The workspace says what the tool does.**

CuratorOS UI v1 is the shared interface language for the CuratorOS application suite. It deliberately carries Ocean Liner Curator's institutional identity without reproducing the public site's museum/editorial presentation inside operational software.

## Design principles

1. **Institutional, not generic SaaS.** Deep green-black surfaces, restrained brass identity, editorial typography, and quiet depth make CuratorOS recognizable without decoration competing with work.
2. **Information before decoration.** Data density, legibility, hierarchy, and touch usability win every conflict.
3. **Brass means identity.** Brass marks CuratorOS identity, focus, selection, and primary action. It is not a warning color.
4. **Semantic states stay semantic.** Success, warning, danger, and information use dedicated colors consistently across every application.
5. **Shared chrome, individual workspaces.** Apps share shell, controls, typography, spacing, status vocabulary, and behavior. Their core workspaces remain purpose-built.
6. **iPad first.** Primary layouts are comfortable on iPad, adapt cleanly to iPhone, and expand naturally on desktop.
7. **Progressive migration.** Existing tools do not require wholesale rewrites. Adopt tokens/components as each tool is touched.
8. **Accessible by default.** Minimum 44px touch targets, visible focus states, reduced-motion support, sufficient contrast, semantic HTML, and keyboard operability.

## Canonical tokens and components

`curatoros-ui-v1.css` is the initial source of truth. It defines:

- identity and semantic color tokens
- display/UI/monospace font stacks
- spacing scale
- radii, shadows, focus treatment, transitions
- application shell and header
- panels and interactive cards
- primary/secondary/destructive buttons
- inputs and selects
- status badges
- metric blocks
- data tables
- empty states
- responsive and reduced-motion behavior

## Application anatomy

A CuratorOS application should generally read as:

1. **Identity / app header** — Ocean Liner Curator eyebrow, tool name, concise purpose/status.
2. **Tool controls** — search, filters, primary actions, scope selectors.
3. **Workspace** — purpose-built content for the tool.
4. **Operational feedback** — semantic status, warnings, errors, empty/loading states.
5. **Utility/footer** — version, storage/source information, or low-priority system metadata when useful.

The workspace does **not** need to resemble other CuratorOS workspaces. A graph should remain a graph; an editor should remain an editor.

## Migration order

Initial target sequence:

1. Launch — reference implementation
2. Site Health — dense operational test
3. Search Intelligence
4. Content Opportunity Finder
5. Link Map
6. Curator Integrity / Speed / Indexer
7. Page Studio after the component vocabulary matures
8. Analytics built natively against UI v1
9. Core CuratorOS after the 1.0 release line is stable

## Usage

For lightweight Worker/static applications, the CSS can be copied or served as a shared asset once deployment/versioning strategy is finalized. Do not hot-link an unstable branch in production.

Use `cos-` as the namespace for canonical shared classes and `--cos-` for design tokens. Tool-specific CSS should sit above these primitives and should not redefine their semantic meaning.

## Versioning

UI v1 is intentionally conservative. Backward-compatible additions may remain within v1. Changes that alter token meaning, component semantics, or application anatomy should be treated as a new design-system version.
