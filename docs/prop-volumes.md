# Sprite-derived scenery volumes

Trees, mountains and Hero's Den in Proto immersion are fixed voxel solids reconstructed
from the existing pixel sprites. Each horizontal silhouette row becomes an
elliptical cross-section. Narrow rows retain trunks; wider stepped rows retain
branches. Separate authored bands keep tree crowns and mountain peaks distinct.
Source colours wrap continuously around the perimeter using both ground axes.
The dominant normalized X/Z coordinate selects a row projection; quadrant signs
join those projections at corners. Every exposed face of a voxel, including its
horizontal ledges, uses the same material. This avoids extending dark sprite
outlines into side slabs or changing material at every stepped ledge. Nearest
opaque row sampling closes texture holes without introducing transparent gutters.
Asymmetric recipes retain their authored front/rear materials; the den's cave
interior remains distinct. Single sprites still approximate unseen surfaces.

This replaces the single-plane scenery trial for these assets. The existing CSS
table camera and interactions stay in place. A small, depth-tested projection
of each solid is composited into that scene; its display canvas faces the camera
while the depicted geometry, colours, lighting and placement stay in world
coordinates. A complete turn returns the same view. Camera descent changes the
projection elevation, without moving the foot or changing the object's scale.

The renderer shares one offscreen Three.js context, source geometry and a bounded
96-view cache. Each model also retains up to 24 lighting variants in an LRU, so
instances with different local lights do not rebuild and upload vertex colours
on every orbit frame. Camera callbacks queue uncached views in one microtask,
deduplicating identical requests. A 4×4 atlas renders up to sixteen views before
one GPU-to-CPU transfer; larger batches roll over into additional atlas transfers.
Only the current effect/camera request may paint the destination canvas.
A pure Canvas rasterizer supplies the same solid when WebGL is
unavailable. `?propRenderer=canvas` exercises that fallback. Views update from
the live camera subscription; stationary props have no animation loop. Views
are quantized to 2 degrees yaw and 1 degree elevation. Source reconstruction is
bounded to 64 pixels on its longest axis; output projections and destination
canvases use 128×160 pixels, enlarged by CSS nearest sampling. The flat sprite
renderer keeps its own oversampling; expanding already-rasterized voxel views
before upload added no detail and increased every orbit-frame bitmap upload.

The real solid also supplies ground shadows. Two-axis footprint fitting reserves
depth on the owning tile, including its north/south edges. Default main solids
are centered and occupy about 88% of a 48-unit tile's width, with comparable depth.
Ground width sets scale, retaining the artwork's height proportions. Fixed
per-solid projection bounds accommodate tall trees without resizing on orbit.
Top-down continues to use the existing overhead prints. Discovery, blocked cells
and actor grabs retain their existing rules. Reed art retains its authored plane.

## Extending the props

Add the asset filename to `PROP_VOLUME_RECIPES` in `src/proto/propVolume.ts`:

```ts
'new-tree.png': { bands: [0, 1], depth: .9, trim: true }
```

- `bands`: normalized horizontal boundaries, starting at 0 and ending at 1.
  Use a single band for one tree; split clusters at individual trunks/peaks.
- `depth`: depth relative to silhouette width. About .85–.9 keeps conifers and
  mountains substantial from the side.
- `trim`: remove transparent padding for main pop-ups; leave it false for edge
  props whose width and height already describe their artwork.

The map automatically picks registered assets up for both main and edge props.
Other artwork uses its existing renderer. Use a new filename for an independently
authored recipe. This is a reusable starting method for approximately radial
scenery, not a reconstruction of unseen detail: rear bark, foliage and rock use
the source palette. Hero's Den uses the `shape: 'cave'` recipe to carve a deep
front arch while retaining a closed rear, thick roof and side walls. Its recipe
flags `symmetry: 'asymmetric'` and `facing: 'north'`; heading is baked into the
solid's vertices and lighting normals, so the entrance and shadows keep their
world orientation during orbit. Dark interior faces distinguish the opening
from the exterior stone. A different strongly asymmetric building or landmark
should get explicitly authored 3D geometry/materials or directional artwork.

## Validation

`src/proto/propVolume.test.ts` checks solid views around the orbit, low angles,
world lighting, unsupported artwork and complete ground-footprint fitting.
`tools/prop-volume-playwright.cjs` checks the real app at 1280×720 and 1912×914,
including mouse/touch turns, full-orbit artwork, foot stability, camera descent,
trees, mountain shadows, top-down restoration and the shared footer layout
check. It saves 3× screenshots and pixel measurements in `artifacts/prop-volume`.

`tools/voxel-surface-playwright.cjs` compares all six recipes at five headings
against the CPU renderer, checks thirty views across atlas rows and chunk
rollover, and checks that alternating lighting variants restores identical ink.
It saves enlarged material galleries and pixel measurements in
`artifacts/voxel-surface`. The unit regression also checks that a sprite's dark
border does not expand into a side slab.

The shared GPU projection uses an [orthographic camera](https://threejs.org/docs/pages/OrthographicCamera.html)
to keep object size stable between local views, with the existing CSS table
camera supplying the world perspective. Three's [nearest texture filtering](https://threejs.org/manual/pages/textures.html)
documents the pixel-preserving sampling principle; these projections use nearest
Canvas sampling when enlarged rather than a filtered texture plane.
## Berry patches

`berry-patch` selects `berry-bush.svg` by type; its overhead print is `berry-patch-topdown.svg`. Pixel assets are reproducible with `node tools/make-berry-bush-art.mjs`. The berry-bush volume recipe builds authored overlapping shrub crowns, stems and three-dimensional fruit bunches on every side, rather than sweeping a tree sprite. It uses the shared lighting, projection, shadows and occlusion renderer. Both assets share the foliage and ripe-berry palette. Discovery shows full-color bushes; picked tableau cards remain spent without removing the vegetation.

