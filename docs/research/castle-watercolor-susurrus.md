# Castle water and watercolor review

2026-11-08. Scope: `/118.html`; preserve the new dusk, lanterns, controls and navigation.

## Reference findings

Xianyao Wei's [Susurrus case study](https://tympanus.net/codrops/2026/04/24/susurrus-crafting-a-cozy-watercolor-world-with-three-js-and-shaders/) combines a low-resolution reflective surface, a separate animated water layer and lighting. Its overall painterly treatment uses a simplified Kuwahara post-processing pass. The article's direct page returned HTTP 403 during this review; the search engine's indexed text of that same primary source supplied the article contents. The author does not publish enough water-shader code there to reproduce the exact surface. Our implementation is an adaptation, not a port.

[Maxime Heckel's painterly-shader study](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/), cited by Wei, explains how Kuwahara filtering groups similar colors while retaining boundaries. It also demonstrates the tradeoff between smoothing strength, block artifacts, edge fidelity and the greater cost of orientation-aware filtering. These results support modest filtering of reflection detail, rather than indiscriminately smoothing the entire game.

The [Drei reflector material source](https://github.com/pmndrs/drei/blob/master/src/materials/MeshReflectorMaterial.tsx) exposes reflection, distortion, roughness, blur and depth controls. We use the installed Three.js r170 `Reflector` helper instead of adding React Three Fiber/Drei to this scene. [Three.js documents](https://threejs.org/docs/pages/Reflector.html) reflection texture dimensions and multisampling as explicit options; its installed implementation also saves/restores renderer state and suppresses automatic shadow refresh during reflection rendering.

## Implemented water adaptation

- A small planar reflection captures the actual castle and lanterns. Auto/Medium use 256×256 at most 12 times per second; High uses 384×384 at most 18 times per second. Low creates no reflection targets, and Auto's existing fallback releases them. These are configured budgets, not measured hardware frame-rate guarantees.
- A compact four-sector variance filter runs on that reflection texture at capture cadence. It never processes the main framebuffer. Hero, UI and the surrounding artwork retain their existing rendering.
- The old tiled water marks and regular sine-product sparkle grid are removed on page 118. Continuous world-space noise drives slow flowing color washes, pigment accumulation between tones, broken elongated highlights and distorted reflection coordinates.
- A one-time 256×256 shoreline-distance field uses the actual dry-land polygons. It avoids false foam across joins between water channels, and creates lighter diluted margins and darker deposited pigment near banks. It is a stylistic shallow-water cue, not physical depth or refraction.
- Waterfall and landing foam use the same animation clock with long vertical pigment streaks. Reduced motion freezes the wash pattern while reflections still respond to deliberate camera/player movement. Low retains the static painted surface, shoreline and lantern lighting.
- Existing cached shadows are reused. Reflections hide water surfaces and decorative point batches to prevent feedback and unnecessary particle draws. Reflected trees/standees retain their main-view posture; they are painted approximations, not separately posed reflection actors.

## Opportunities for the existing watercolor materials

These are recommendations from inspecting `castleWatercolor.ts`, `castlePaint.ts`, `castleGrounds.ts` and the new lantern materials, not changes silently applied to every scene.

1. **Filter detail according to its projected size.** The shared shader samples grain at fixed world frequencies of 5.5, 17 and 23. At distant viewpoints, the smallest frequencies can become shimmer rather than paper texture. Apply derivative-based fading or bake the finest grain into mipmapped maps. The new water fades its finest paper tooth with pixel footprint. Compare stationary, orbiting and zoomed views before extending that approach globally.

2. **Vary brush scale by surface and viewing role.** The current common noise scale covers masonry, paths, roofs and timber. Give each material authored wash/grain scales and directional grain; favor broad grouped values at normal distance, with smaller marks appearing only nearby. This should improve material identity without adding passes.

3. **Strengthen pigment behavior, not just noise contrast.** Existing band transitions already accumulate pigment, but the finer granulation mostly multiplies brightness. Try pigment-colored deposits at wash margins, lighter interiors and broken dry-brush coverage tied to a shared paper-height field. Keep paper color distinct from light color so a warm lantern does not simply bleach all pigment to yellow.

4. **Soften regular masonry detail in the baked texture.** Dense repeated mortar and individually picked-out oval bricks can dominate broad lighting shapes. Reduce contrast and vary edge completeness/brush width at bake time. Preserve castle silhouette and real geometry; do not blur architectural boundaries to hide repetitive texture.

5. **Make new local lights explicitly compatible with watercolor shading.** The common watercolor chunk reconstructs the first directional light plus indirect light; arbitrary added point lights would not automatically survive that reconstruction correctly. The lantern pass now adds its own bounded surface illumination after that reconstruction. A future shared multi-light solution should preserve all light contributions before artistic quantization.

6. **Consider a small, masked painterly pass only where geometry still looks too clinical.** Water reflection filtering is an isolated proving ground. A future scenery-only experiment could compare a modest four-sector filter with an edge-aware variant, protecting Hero, text and interaction markers. A whole-frame Kuwahara pass would conflict with the current material-level watercolor contract and could erase authored art detail; it needs a separate visual decision and measured GPU budget.

The highest-value next experiments are projected-scale grain filtering, material-specific brush scale, and quieter masonry textures. Each can be compared at the same camera and lighting without changing gameplay or layering another full-resolution render pass.
