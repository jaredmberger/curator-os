# Corpus Intelligence field audit

Canonical Ship Record schema v2 stores maiden voyage in `data.maidenVoyageDate`.

Build Corpus v2 maps the Key Facts labels `Maiden voyage`, `Maiden voyage date`, and `First voyage` to `maidenVoyageDate`.

CuratorOS v0.6.0 Corpus Intelligence accidentally checked `data.maidenVoyage`, causing a false 0% coverage / missing-field report for maiden voyage even when imported Ship Records contained the canonical value.

v0.6.1 corrects the intelligence check to `maidenVoyageDate`.
