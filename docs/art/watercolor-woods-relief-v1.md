# Watercolor woods relief v1

Historical experiment: Eric's later 2026-10-12 feedback supersedes the painted relief renderer with direct cutouts. See `watercolor-woods-sprites-v1.md` for the current game integration. The sources, prompts and geometry below remain for reference.

Generated with the built-in ImageGen tool on 2026-10-12. Preserve the pixel asset set.

## Sources and prompts

- Cluster concept/source: `public/assets/biomes/sources/watercolor-v1/woods-cluster-source.png`.
- Single tree/runtime relief material: `public/assets/biomes/watercolor-v1/pine-relief-v1.png`.
- Edge/Old Tree material: `public/assets/biomes/watercolor-v1/pine-edge-relief-v1.png` (same source, separate recipe).
- Overhead companion: `public/assets/biomes/watercolor-v1/woods-overhead-v1.png`.

### Cluster prompt

Use case: stylized-concept. Asset type: production transparent watercolor forest sprite source for a 360-degree relief prop in Exploritaire. Create a single coherent small cluster of THREE distinct evergreen pine trees, a taller middle tree and two slightly shorter flanking trees. Orthographic straight-on front elevation, entire trees and brown trunks visible, ground-level feet aligned, plenty of transparent gutters. The cluster should be compact and approximately square overall. Individual trees have loosely tiered bough masses, visible small air gaps between crowns and distinct trunks. Style: loose hand-dabbed watercolor from broad irregular wet brush dabs and a few large pigment pools. Rich forest green, jade, muted olive and deep indigo-green foliage, warm umber trunks, sparse broken charcoal/indigo ink-brush accents. Soft wet-on-wet color transitions, water-diluted fades, selective harder pooled pigment boundaries, imperfect wash registration, softly feathered edges. Lose all small needle and bark details; broad painted masses explain form. Opaque foliage interiors with partially transparent fading edge bleed. Neutral diffuse illumination with NO directional cast shadows. Avoid pixel art, squares, voxel steps, polygon faceting, digital gloss, dense outlines, paper noise, stippling, grain, repeated tiny strokes. No backdrop, no ground plane, no scenery, no text or signature; genuinely transparent background and gutters. This is a cutout game asset, not a painting on a paper rectangle.

### Single tree prompt

Use case: stylized-concept. One production game sprite: a SINGLE evergreen pine tree in strict orthographic straight-on front elevation, whole tree including short umber trunk and aligned flat ground contact, wide transparent gutters. Overall broad squat pine silhouette, height about 1.6 times canopy width. Genuinely transparent background. VERY loose watercolor, FEW LARGE broad irregular wet brush dabs and pigment pools, simple tiered bough masses, no individual needles. Rich deep forest green and indigo green, jade and olive color blooms with sparse broken charcoal brush accents. Dark opaque canopy interiors, soft uneven feathered outer paint edges. Neutral diffuse lighting, no directional shadow. Deliberately coarse expressive painting with lost details, no fine veins, microtexture, grain, stippling, squares, pixels, facets, digital gloss, intricate decorative branches or continuous outline. No paper rectangle, no backdrop, no ground, no landscape, no text, no signature, no baked cast shadow.

### Overhead prompt

Use case: stylized-concept. Asset type: transparent overhead game tile sprite, companion to a watercolor pine relief. Strict orthographic top-down view looking vertically down on THREE evergreen pine crowns, a large middle crown and two smaller flanking crowns arranged compactly with small transparent ground gaps. Entire roughly circular irregular crowns visible, transparent gutters on all sides. A few tiered bough masses radiating outward, the tips of the trees visible from directly above. Loose hand-dabbed watercolor: broad wet irregular brush dabs, a few large pigment pools, rich deep forest green and indigo-green, jade and olive washes, sparse broken charcoal accents. Soft wet-on-wet transitions and diluted fades, uneven edges, lose needle details. Opaque canopy interiors and partially transparent feathered watercolor fringe. Match a lush green painted pine cluster. Neutral diffuse light; no ground shadow, no backdrop, no dirt, no grass, no paper rectangle, no text or signature, no pixel art, no voxel steps, no digital glossy shading, no grain or stippling. True transparent background.

## Integration contract

`sceneryArt.ts` selects existing painted counterparts through the Paint/Pixel setting. Old Tree uses a single painted tree; woods use a three-tree relief plus independent edge props. No new gameplay or discovery rule. Unknown tiles still conceal all scenery. Overhead art remains a flat print with its generated alpha. Relief cores remain opaque; source alpha above 100 defines the silhouette, so faint outer bleed is not extruded into solid geometry.

`paintedPropVolume.ts` sweeps the source silhouette into closed rounded rings with continuous interpolated pigment and surface normals. A small smoothing filter removes raster steps without losing broad bough tiers. Fixed authored tree instances produce real two-axis ground depth, and a once-only bounds fit keeps the whole group inside its tile. Surface lobes are broad geometric contour variation, not procedural paint noise. Side/rear pigment is a reconstruction from the front source, not independently authored directional art.

Painted views rasterize at 384×480 with smooth browser sampling; pixel views keep 128×160 and nearest sampling. Geometry, shadows, GPU buffers, lighting uniforms, the bounded projection cache, worker atlas and CPU fallback remain shared. The existing live orbit/elevation and actor peek masks consume the same physical relief canvas. There is no additional actor rig or per-prop WebGL context. Pixel scenery and unrelated den, mountain, berry and reed assets retain their recipes.

The separate Three.js combat arena still has its existing scenery renderer; this first relief pass targets the Proto orbital map. Decorative TableauScene cutouts can select the new paint source, but do not become orbital solids.

## Validation

Run `node tools/painted-woods-playwright.cjs` against local Vite. Evidence is under `artifacts/painted-woods-v1/`: full 360° gallery, front/side closeups, desktop mouse and touch orbit, fixed footprints, low elevation, overhead restoration, Paint/Pixel switching, opaque coverage and mixed pixel/paint GPU atlas plus CPU fallback. Focused unit tests are `paintedPropVolume.test.ts`, `propVolume.test.ts` and `actorPeek.test.ts`. Record actual results in the report beside screenshots; running a build alone is not visual verification.

