# Dynamic berry bush scaffolding

The `*-empty-v1.png` foliage canvases in `public/assets/biomes/watercolor-v1/` were edited from the matching sparse v1 and dense v2 standee/overhead sources with ImageGen on 2026-10-16. Prompt: remove all pink/red/magenta/wine fruit, fill those areas with olive green watercolor foliage, and retain canvas dimensions, silhouettes, positions, stems, transparent gaps, scale and composition. The four outputs were visually inspected before integration.

Pixel counterparts are native SVG copies with fruit pigments replaced by foliage pigments. The empty pixel volume omits its fruit geometry.

`manaberry-fruit-v1.svg` is an independent, code-native broad pigment fruit mark. `BushBerries` places individual fruit images over the registered foliage canvas. Three.js tableau scenery uses separate textured fruit planes parented to each moving bush. Neither renderer uses the old fruit-bearing painting as its fruit layer.

Sparse availability follows `berryHarvested`; dense availability checks remaining berry/mana reward cards, including stock. The selected deal uses its live tableau and stock rather than the cached tile deal. Placements are deterministic presentation scaffolding: there is no per-bush inventory or exact visual fruit count yet.

Validation: focused Vitest coverage, TypeScript, isolated Playwright ripe/depleted checks in both camera views at 1280×720 and 1912×914, a shared layout check, and 3× screenshots under `artifacts/dynamic-berries/`. The tableau check also verifies selected-deal depletion removes map fruit.
