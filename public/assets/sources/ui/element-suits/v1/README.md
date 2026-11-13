# Elemental suit art v1 — 2026-10-27

Generated with built-in ImageGen, one transparent production sprite per element. Source outputs are preserved here as `<element>-master-v1.png`; runtime sprites are in `../../../../runtime/ui/element-suits/`. The reference is `runtime/ui/momentum/spiraling-ember-v1.png` (style only). No existing Momentum art was modified.

## Shared prompt (exact)

Use case: stylized-concept. Asset: ONE production elemental suit icon for Exploritaire fantasy solitaire cards. Reference image is STYLE REFERENCE ONLY: match its authored watercolor pigment, broad merged wet washes, pooled broken rims, selective dark warm ink accents, layered translucent edges and pale luminous painted cores. Subject: [subject below] Center ONE compact recognizable symbol filling 82% of a square canvas with even padding. Readable as a 28px card-corner pip. Rich saturated identity colors, varied soft/hard painted edges, opaque pale highlights. Genuinely transparent background and inner negative spaces. No lettering, no labels, no numerals, no border, no badge, no paper rectangle, no checkerboard, no ground shadow, no baked external gameplay glow, no vector-flat or 3D-render look. Preserve the handmade watercolor medium of the supplied Momentum reference, but make the requested element shape distinctive.

## Subjects (exact)

- Earth: `EARTH: a compact craggy three-facet stone/mountain silhouette, earthy burnt sienna and ochre with ivory sunlit planes, no scenery.`
- Air: `AIR: three sweeping pale mint and turquoise wind ribbons curling upward around open negative space, unmistakable breeze silhouette.`
- Fire: `FIRE: a single upright dancing flame with three tapering tongues, vermilion/orange/amber washes and pale ivory heart. Distinct from the reference's circular Momentum spiral.`
- Water: `WATER: one deep cobalt and azure teardrop with a curling wave crest folded inside, pale cyan/ivory highlights.`
- Nature: `NATURE: a single broad emerald/sap-green leaf with a short curving stem and pale vein, organic asymmetric silhouette.`
- Chaos: `CHAOS: an asymmetric jagged violet and magenta rift/star with three irregular hooked shards twisting around a small pale negative-space core, readable angular disruption, not a dark moon.`

## Integration

Six suit identities are Earth, Air, Fire, Water, Chaos and Nature. Chaos replaces the seeded Dark bucket; Nature replaces the seeded Light bucket, preserving all other seeded assignments and equal distribution. Display-only opposed pairs are Earth/Air, Fire/Water and Chaos/Nature. This does not rename unrelated ability or character elements.

`ElementGlyph` renders shared transparent images in tableau headers and foundation labels. Rank text, gameplay state and accessible suit names remain code-rendered; no text or gameplay effects are baked into the sprites. Runtime exports preserve transparency and reduce image dimensions for small UI use.
