# Elemental perimeter paintings v2

The five existing adornment components now render a shared decorative image wrapper.
Existing ProtoCard flags and suit semantics remain intact. Painted clusters have
unequal size and placement, transparent centers and open gaps. The overlay extends
6% beyond the card on each side, stays at the existing decoration depth and does
not capture pointer events or native image drags. No idle animation was added.

Generated with the built-in ImageGen tool. The first five uniform border studies
were rejected by Eric for symmetry; the second set uses a dominant lower-left
cluster with smaller disconnected top/right accents. Exact prompts for both sets
are in [manifest.json](../../public/assets/sources/ui/card-adornments/manifest.json).
Versioned PNG masters remain beside the manifest. Runtime PNGs under
`public/assets/runtime/ui/card-adornments/{nature,fire,water,air,earth}-v2.png`
are exact copies of the second masters, preserving original alpha and paint.
`tools/prepare-card-adornments.mjs` records the source-to-runtime mapping.

Validation: TypeScript typecheck passed. One headless Chromium run loaded Scenario
1002, decoded all five assets, verified transparent centers, opaque paint and
substantial horizontal alpha asymmetry, and checked 20 live decorations for
noninteractive image behavior with no remaining SVG adornments or page errors.
Desktop and compact screenshots are in `artifacts/card-adornments/`.
Desktop ranks and overlapping headers remain readable. In the compact screenshot,
the existing expanded scenario notes obscure part of the board; full compact-board
visibility and drag/keyboard interaction were not separately exercised.
