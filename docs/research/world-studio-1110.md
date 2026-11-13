# World Paint Studio — page 1110

## Page 1111 geometry-painted tree

[Geometry Painter](https://patch.gg/patch/geometry-painter), source
`https://git.patch.gg/patch/geometry-painter.git`, revision
`0596b4bca863740a5c3c14ed794f05ba7e78055d`, wraps mohamedachrefelouafi's MIT
GeometryPainterThreeJS. Both MIT notices are retained in
`src/book/vendor/patch-geometry-painter/`.

Its WebGPU/TSL implementation targets three r186. Page 1111 instead adapts the
Aurora Silk and Glowing Reef modes to the existing WebGL/r170 renderer in
`worldTreeGeometryPaint.ts`. Silk uses the reference's doubled sheets (the back
layer has phase 2.4 and stature .72), coupled traveling fold displacement and
brightness, vertical rays, bright hem and motes. Reef retains branched dark
colonies, luminous polyp tips with the shared world-space pulse, swaying
anemones, vein-only sea fans and drifting plankton. Growths follow actual tapered
limb surfaces and are added after solid camera bounds are collected.

Six shared draws, 64/112 reef colonies on Low/normal, one uniform clock and
static instance matrices keep the work bounded. No reference point lights,
bloom pipeline, BVH prototype hooks or WebGPU renderer are installed. Existing
bark and leaf painting remain separate. Localized mist/depth still occlude the
effects, and reduced motion freezes their clock. Pages 1110 and 120 omit them.

Flurry's generated overlays and random face rig are documented in
[`docs/art/flurry-expressions-v2.md`](../art/flurry-expressions-v2.md).

This is an authoring fork of page 120. The original World Tree route, scene,
paint treatment and authored files remain independent of the new experiment.

Page 1111 copies the current 1110 recipe into `src/data/worldStudio1111.json`.
Its editor uses `/__world-studio1111` and a separate draft key; saves/imports
must match the active page. It omits construction and rendering of the book
portal and starts at the shared post-portal world pose, 1.2 seconds into the
cleared approach. Replay resets to that same pose, and Skip accelerates the
remaining route into the existing follow-camera handoff. `Edit=true` and
reduced motion retain their direct-to-play behavior. Page 1110 keeps the book
opening and its independent recipe.

Page 1111's encounter framing and marked ground patches are configured in
`world1111Layout.ts`. Arrival uses the supplied telemetry's yaw 1.026, pitch
.426 and 12.5 m boom around Hero (4,74), reproducing the supplied camera
position and direction through the shared follow model. Flurry's independent
position projects her floating center onto the subsequent screenshot's
crosshairs; the slime remains at (8,71).
The slime reuses the existing authored directional watercolor rig. Flurry
opens the shared sticker-memory placement process
when clicked within six metres. Collection and the chosen single enhancement
use progression storage (`exploritaire.world1111.flurry`), never a studio
recipe. A retained sticker button reopens the reward after dismissal; musical
combat can consume the same collected attachment. Flurry remains visible at
her authored world position after collection; nearby subsequent clicks inspect
the existing reward and never grant another copy or reset its enhancement.
Sticker meshes participate in the normal alpha-aware point-to-click prop
picker. Clicking Flurry from farther away queues a supported-ground approach
through `CastleGroundsNavigation`; grounded entry into pickup reach opens the
reward automatically. The interaction belongs to that specific route and is
cancelled when the route is cleared or replaced. An unreachable approach
reports failure rather than teleporting Hero or collecting remotely.

Flurry's world presentation reuses her authored ice/body and face layers.
Camera-relative face parallax is combined with smoothly eased, seeded random
glances and small body tilts. A separate local snowfall batch spans about
26 m above her, with 384 flakes on Low and 768 otherwise, including denser
flakes near the sticker. Six-armed flakes carry soft icy luminosity in their
own fragment shader; no lights, bloom or extra reflection capture is added.
Terrain, depth and localized basin fog still occlude the field. Snow particles
are excluded from picking and reflection captures. Reduced motion holds a
filled static storm and neutral face. Animation changes uniforms/transforms,
without rebuilding or uploading per-particle buffers each frame.

Camera telemetry opens selectable JSON before any clipboard attempt. Manual
copy remains available when clipboard permissions fail. Darker Autumn is an
optional saved pigment palette: it deepens Autumn Wood mixtures and grass
without changing daylight, atmospheric fog or the other palette presets.
Reward intros clip decorative snowfall overflow and adapt to short screens
without visible scrollbars. Longer effect lists retain scrolling with hidden
scrollbar chrome.

## Reference implementation and provenance

- [Oil Paint, Patch / Blendi](https://patch.gg/blendi/oil-paint), public source
  `https://git.patch.gg/blendi/oil-paint.git`, commit
  `6a5b4f56769a6a6964b4aa7f3cc29c7cca5ba930`.
  `src/book/vendor/patch-oil-paint/brush.js` is the upstream eight-mark brush
  sheet generator, copied verbatim with its MIT notice. Exploritaire adapts
  the documented surface-pinned, directional-dab method in `worldOilPaint.ts`:
  area-weighted triangle samples, world-fixed anchors, projected minimum mark
  sizes, grouped paint values, color streaks and restrained relief. Static
  surfaces do not upload new pin buffers during camera movement. Ground marks
  lie on the exact terrain triangles. Hero and existing raster standees retain
  their authored art. The upstream opaque-only renderer, post pass, wanderer,
  physics, shadow maps and film are not imported.
- [Soil and Grass, Patch](https://patch.gg/patch/soil-and-grass), public source
  `https://git.patch.gg/patch/soil-and-grass.git`, commit
  `a644e99d1848444d75568b48b33234d957afbdbe`.
  The vendored `grass.js` and `soil-shaders.js` preserve the source and notices
  from Patch and Soil Studio by mohamedachrefelouafi (MIT), including upstream
  GrassSystemThreeJS commit `b236b2a`. The reference's instanced curled blades,
  coherent wind, patch variation, simplex noise, and wetness/growth field are
  used with the existing terrain instead of the reference demo's slab. Shader
  grass height is sampled from a compact encoding of the terrain vertices and
  uses the same barycentric interpolation as the visible triangles. No source
  photographic soil textures, cars, volumetric post stack or renderer are used.

## Watercolor adaptation

The selected configuration is **Autumn Wood** (2026-11-11): gold/russet leaf
and litter mixtures and oak bark colors adapted from the pinned reference's
`src/world/forest.js` and `src/world/floor.js`, including its low-sun stroke
direction. The canopy underpaint, moss and grass use matching warm/olive tones.
It is the saved and reset default for page 1110; the earlier cool grove and
other palettes remain valid for existing recipe imports.

The subsequent coverage/color correction keeps the Autumn Wood ground/litter
mixes but paints Yggdrasil's wood brown and main foliage green. A continuous,
world-anchored field of four overlapping brush marks is normalized per fragment
on the actual terrain/tree materials. Each mark has a positive pigment body
beneath its dry-brush mask, so there is no unpainted gap even when all sampled
bristle masks are dry. Coverage 1 fully replaces the underpainting with this
mixed paint across all terrain triangles, including steep and non-walkable
areas. Pinned geometry marks now supply additional texture/detail; their
quality budget does not determine whether the base surface is painted.

The references provide paint and planting algorithms. `art.md` continues to
govern the medium: broad merged marks, feathered lost edges, quiet gaps, muted
grove/ochre/moonlit mixes, and modest pigment relief. This is a code-native
paint-method experiment with existing paintings, not newly generated artwork.
Water, wisps, luminous ivy and spectral fruit retain the scene's established
renderers and mist. Bark and main foliage remain non-emissive.

## Tooling and persistence

### Bright atmosphere and optional smoke (2026-11-11)

Page 1110 now uses daylight with no vignette or blanket darkness. Ground mist
remains terrain-following and pale. Tree/waterfall fog is restricted by a
world-space perimeter/cascade mask, so the central Yggdrasil is not hidden by
the old global altitude veil. Original page 120 retains its dark-basin policy.

[Particle Physics](https://patch.gg/patch/particle-physics), public source
`https://git.patch.gg/patch/particle-physics.git`, commit
`788280e4e0b3dfa7c46dcdda5a1742a97f522f92`, supplies the smoke direction.
The source's `src/scenes/smoke.ts` and Daniel Greenheck's Three.js Particle
Fluids use heat/buoyancy 3, exponential cooling .6, six-second smoke tracers
and swirl .35. The original SPH gas/fluid solver and volume renderer require
WebGPU and three r186; Exploritaire uses WebGL/r170. `worldSmokeWisps.ts`
therefore adapts buoyant rise with exponential cooling, curl/swirl, fading
lifetimes and soft turbulent density into one bounded instanced draw (96 on
Low, 192 otherwise). It does not implement SPH, fluid coupling or the reference
simulation's collisions. Ordinary depth testing occludes wisps behind solids.
No compute renderer, extra capture pass or per-frame particle-buffer upload
is added. Both MIT notices are retained under
`src/book/vendor/patch-particle-physics/`.

World Studio → Ground exposes Smoke wisps, density, rise and swirl. It is off
by default and saves with the recipe; old recipes remain valid. Reduced motion
holds the game clock at zero, retaining a deterministic still wisp field.

World Studio has Paint, Ground, Objects and Camera workspaces. Changes preview
live. Ground brushes paint growth/paths and wet/dry soil. Authored trees and
rocks have transform handles, numeric placement, ground snap, duplicate and
delete. Undo/redo, camera shot capture/revisit, validated JSON import/export,
recoverable browser drafts, and explicit disk save/reload use one page-scoped
document. Disk saves use optimistic revision checks and atomic replacement of
`src/data/worldStudio1110.json` through the trusted dev endpoint
`/__world-studio1110`. Browser storage is draft recovery, not permanent authoring.
Hero movement, combat/session state, flight progress and browser preferences
are not serialized. Placed props join navigation and fly-in collision bounds.

Grass is capped at 48,000 blades on Low and 140,000 otherwise, in one draw.
Surface marks have bounded quality-dependent budgets and one draw. Both are
GPU-rendered inside the existing frame loop. No reflection, shadow or bloom
capture pass is added. Reduced motion freezes wind and existing effects.


### Page 1111 ivy alignment, luminosity and slime follow-up (2026-11-11)

Aurora Silk now consumes the exact tapered-surface paths exported by the ivy builder (27 doubled curtains in the current tree), rather than independent branch-top paths. Page 1111 doubles the climbers and clusters three painted leaves at each planting site; other pages keep their prior density. Traveling silk peaks and depth-tested soft polyp coronas add apparent luminosity without light objects or bloom. Geometry Painter now uses seven shared draws, including its new polyp halo batch. The bark/main foliage remain non-emissive; continuous mixed paint on this page retains scene illumination rather than overwriting it at coverage 1.

The slime stain is a world-space irregular pigment mixture shared by pinned and continuous ground paint, with matching nearby grass tint. Red-black rising smoke and sparse red flecks use one bounded GPU batch (84 Low / 144 otherwise), no per-frame buffer uploads, and frozen reduced-motion time. Effects remain excluded from water captures and navigation solids.

Validation: type checking and focused unit tests; headless WebGL fixture `artifacts/world-effects-depth-preview.html` compiled the combined mixed paint, ivy, silk, reef, face/cutout and miasma shaders without browser errors. Pixel checks confirmed an opaque sticker occludes later magenta paint, while its Hero-alpha opening matches unobstructed Hero color. This focused fixture does not replace a full-page visual playthrough.
