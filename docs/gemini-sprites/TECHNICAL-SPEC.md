# Sprite contract and integration details

This document separates verified runtime behavior from a suggested Gemini delivery convention. Source files in `reference-code/` are the authoritative snapshot. This handoff does not add a new loader or change rendering.

2026-10-10 update: Hero now has a sitting definition (`heroSittingSprite.ts`) with eight authored views per tier plus overhead. `createDirectionalSpriteLibrary` accepts additional named pose definitions and its instances expose `setPose(name)`; poses must share joint IDs/order/parents. Hero sits at idle and stands during travel/action. Awake tabletop Hero uses a centered world-rotated overhead print for the selected pose. Brows across Hero artwork are gentle and curious; future art must retain this expression. Sitting packing metadata is included in the references. Historical five-view standing fallbacks still apply as described below.

## 1. Current asset families

| Family | Existing examples | Contract |
| --- | --- | --- |
| Articulated directional quadruped | Hero, Mochi low/high atlases | 5 or 8 complete views per elevation and 1 overhead; three clipped joints |
| Directional single body | Dark slime atlas | Named views with one body mesh; procedural squash |
| Single-view actor/legacy rig | `hero.png`, wolf art, sleeping Hero | Authored image/regions; single-view poses do not automatically gain orbit coverage |
| Scenery | Den, pines, berry bushes, mountains | Separate overhead art and sprite-derived/authored voxel volumes; not the quadruped rig |
| Card/quest illustration | Holocards, Hero in berries | Separate full-art surfaces; no joint/view contract |

Prioritize directional actors for this workflow. A humanoid, flying creature, independently animated wings, separate leg gait, new multi-frame animation or new pose state needs a development contract before artwork production. The quadruped factory provides head/torso/hind, not an arbitrary skeleton.

## 2. Direction and elevation

Canonical eight-view sequence, matching `createQuadrupedSpriteDefinition`:

| Index | ID | Image description |
| --- | --- | --- |
| 0 | front | Nose toward viewer |
| 1 | front-quarter | Front-left quarter |
| 2 | side | Left profile, nose screen-left |
| 3 | rear-quarter | Rear-left quarter |
| 4 | rear | Back toward viewer |
| 5 | rear-quarter-right | Rear-right quarter |
| 6 | side-right | Right profile, nose screen-right |
| 7 | front-quarter-right | Front-right quarter |

Five-view definitions use indices 0–4 and mirror intermediate opposite directions. Eight-view definitions retain separately authored opposite-side textures. Recommend eight for new animals; require eight when markings/accessories are asymmetric. `layout.mirrored` transforms anatomical region geometry; it is not permission to mirror the right-side image.

- Low: near-horizontal source view. High: source camera about 55° above ground. Top: true overhead at 90°, nose up.
- Initial tier selection: high above 40°, top above 72°. Hysteresis: low holds below 44°; high holds between 36° and 76°; top holds above 68°. These are runtime selection thresholds, not extra artwork elevations.
- Horizontal selection quantizes relative camera yaw to 45° directions and uses a small boundary hysteresis of .055 radians.
- View selection is relative to actor WORLD heading, independent of team/screen side. In the Three.js rig heading 0 points +Z and heading π points -Z. Map +Y corresponds to +Z (south); world north is negative map Y/scene Z. Overhead nose-up art is rotated into that heading.
- Existing Hero high-rear falls back to low-rear. Slime high-front/high-rear also fall back. Those are existing coverage limitations, not preferred targets for new packs.

## 3. Suggested production packaging (new convention, not loader schema)

Generate/approve individual frames first. Pack with deterministic tools afterward. Runtime accepts arbitrary atlas dimensions and measured rectangles; it does not require a regular grid, a fixed resolution, power-of-two textures, or this proposed arrangement.

- Low atlas: 4 columns × 2 rows, canonical eight-view order.
- High atlas: 3 columns × 3 rows: first eight in canonical order; overhead last.
- Use equal cells within each sheet. Choose cell dimensions only after approving all cutouts. An initial 512 × 512 cell is a planning option, not an engine requirement; enlarge if art does not fit. It would yield 2048 × 1024 low and 1536 × 1536 high sheets, approximately 17 MiB combined decoded RGBA before other GPU overhead. Avoid unnecessary resolution growth.
- Give each silhouette at least 32 transparent pixels on each side of its cell, yielding at least 64 pixels between adjacent occupied bounds. This is a recommended packing margin at that working size, not a renderer constant. Verify actual rectangular bounds; tails must not leak across rows.
- Keep the same pixel density and neutral standing scale across views. Do not stretch one axis or arbitrarily resize each view to fill a cell. Front/rear naturally foreshorten body length. Low-view feet should have a consistent cell baseline; elevated views should have consistent registration appropriate to their perspective. Do not copy a low baseline blindly to overhead art.
- Record tight source rectangles and actual foot/ground anchors even when packing a regular grid. Large transparent padding inside the runtime crop affects sizing: each frame's rendered height comes from its source rectangle, not automatic alpha analysis.
- Format: PNG with actual alpha; sRGB color interpretation; opaque sprite interiors with clean transparent exterior. The runtime uses nearest-neighbor filtering, no mipmaps and alpha test .45 (about 115/255); a soft halo below that threshold disappears. Do not rely on faint semitransparent anatomy. Shadows are supplied separately by the game.
- Filenames: `<actor-id>-directions-low-v1.png`, `<actor-id>-directions-high-v1.png`; individual frames such as `<actor-id>-low-side-right.png`. New versions use new names until accepted.

## 4. Measured delivery metadata

Supply a JSON sidecar for handoff. It is not consumed automatically by the current game. All measurements must come from the exported pixels; no guessed coordinates. Example structure (placeholder values must be replaced):

```json
{
  "schema": "exploritaire-art-handoff-v1",
  "actorId": "new-animal",
  "rigCategory": "quadruped",
  "asymmetric": true,
  "atlases": [
    {"key": "newAnimalLow", "file": "new-animal-directions-low-v1.png", "width": 2048, "height": 1024}
  ],
  "frames": [
    {
      "tier": "low",
      "view": "front",
      "source": "newAnimalLow",
      "rect": [100, 80, 200, 300],
      "groundAnchorPx": [100, 299]
    }
  ],
  "qa": {"realAlphaVerified": false, "neighborFreeCropsVerified": false},
  "notes": "Example only; replace with all measured frames and both sheets."
}
```

`rect` is integer `[x, y, width, height]` in atlas pixels from upper-left, Y down. `groundAnchorPx` is a measured point inside that crop, also upper-left/Y down; it is descriptive delivery metadata, not a supported factory parameter. Describe how feet contact the ground in elevated views. The developer must resolve alignment in the existing frame transform or an authorized shared extension.

No universal target native pixel size is enforced. Report actual raster dimensions and effective pixel/block scale, using the approved reference as a visual standard. Enlarging with nearest-neighbor does not create extra detail.

## 5. Rig anatomy and registration (development responsibility)

`QuadrupedFrameSpec` is `{ source, rect, layout, outline? }`.

- `layout.kind`: `side` for longitudinal anatomical divisions, `stacked` for divisions across image height as needed. Choose from actual anatomy, not a hardcoded view-name rule; Hero/Mochi differ.
- `layout.neck` and `layout.hip`: authored polylines in normalized crop coordinates, upper-left origin, Y down. They divide one coherent drawing into head, torso and hind regions. Every coordinate must be finite and within [0,1].
- `layout.pivots`: exactly three points in head, torso, hind order; normalized crop coordinates with Y UP. Convert an image-normalized point `(u,v)` to `(u,1-v)` before using it as a pivot. Do not confuse this with the sidecar's pixel ground anchor.
- `mirrored` / `inverted`: optional transforms for region/pivot layout appropriate to authored anatomy.
- `outline`: optional normalized convex polygon excluding neighboring atlas pixels. It must not clip the animal; use clean packing for new art to avoid needing guards.
- Shared factory creates slightly overlapping regions (normalized seam margin .018), all using the SAME source rectangle and registration grid. Head and hind parent to torso. Do not duplicate the neck/ruff or place independently drawn anatomy over the body.
- Directional parts have `rect`, `x`, `y`, `height`, `depth`, `pivot`, `clip`, `parent`; quadruped factory sets x=0, y=.5, height=1, depth=0. Rig image width derives from height × crop width/height. Preserve source aspect ratios.
- Neutral/reduced-motion assembly must recover the original silhouette. Breathing/action motion is procedural and subtle; no animation sprite rows are currently read. All views must have the same part IDs/order/hierarchy.
- Normal materials are alpha-tested opaque cutouts; echoes use transparency. MeshBasicMaterial uses baked source color/shading rather than physically lit 3D fur. Keep shading restrained and consistent, without strong camera-specific rim light.

Mochi's high atlas needs two convex crop guards because neighboring sprites intrude into rectangular crops. Hero's detached columns are unused because the anatomy did not agree. Preserve these existing references verbatim; do not reproduce their defects in new artwork.

## 6. Development integration checklist

1. Accept artwork only after identity, direction coverage, alpha, full bounds, rectangular crop isolation and consistent scale pass visual/data checks. Keep originals and prompts.
2. Put accepted actor sheets under `public/assets/actors/battle/`; add source keys to `src/proto/battleSpriteAssets.ts`. Asset URLs include the configured base URL; do not hardcode a deployment root.
3. Author `<actor>Sprite.ts` using `createQuadrupedSpriteDefinition`, with 5 or 8 specs for EACH tier, plus top. Author actor-specific seams/pivots; do not paste Hero anatomy onto a cat or another species. For a one-body creature, use a `DirectionalSpriteDefinition` like slime; other motion types need code work.
4. Create/cache a library using `createDirectionalSpriteLibrary(textures, definition)`, then separate instances with `library.create(height)`. Reuse atlases/geometries; each instance owns its own joints/materials. Set color space/filtering as existing loaders do.
5. Wire the actor into its intended consumer. Battle consumers include `combatDemoRig.ts` and `components/BattleTableauField.tsx`. `components/TableActorSprite.tsx` currently hardcodes Hero and loads only heroLow/heroHigh; a new map actor requires deliberate shared parameterization/integration. The asset registry alone does not enable it everywhere.
6. Preserve world heading across orbit/travel/pose changes, correct top-down rotation, source aspect ratios, ground alignment, labels, occlusion, shadows and reduced motion. Hero's den-specific north heading remains a gameplay presentation rule.
7. Dispose instance materials, library geometries and owned textures at the appropriate lifecycle boundaries. Do not generate a segmented canvas or guess anatomy every frame.

Validation from the project root after integration:

```powershell
npm run typecheck
npm test -- src/proto/directionalSprites.test.ts src/proto/quadrupedSprite.test.ts src/proto/components/TableActorSprite.test.ts
# Start a local Vite instance on 5178 for the existing browser tools:
npx vite --host 127.0.0.1 --port 5178 --strictPort
# Run browser tools in a second terminal:
node tools/hero-proportions-playwright.cjs
node tools/mochi-atlas-playwright.cjs
node tools/actor-rig-playwright.cjs
```

Those tools currently name Hero/Mochi and their current scenes. Extend the appropriate checks to the NEW actor before claiming they validate it. Check all 8 directions at low/high and overhead, neutral silhouette/color registration, connected animated anatomy, no foreign atlas pixels, echoes, reduced motion, camera orbit and desktop/mobile presentation. Relevant map checks include `hero-den-facing`, `actor-shrink`, and `silhouette-depth`; run/adapt when those behaviors are touched. Run the directional benchmark when changing renderer cost or atlas loading. Build/version requirements in GAME.md apply when delivering a game update; this documentation pack does not alter gameplay.

## 7. Optional pose/scenery branches

Sleeping Hero currently has a two-cell source atlas: elevated three-quarter side view on the left, true overhead on the right. `tools/prepare-den-sprites.cjs` trims at alpha >16 and extracts both at 128px width with nearest-neighbor sampling. It also processes the den atlas and overwrites fixed output paths; do not run it blindly for a new actor. This static pose has no complete directional pack. New sleeping/orbit art requires its own agreed pose selection and rig integration, not extra rows in the standing atlas.

Scenery uses `propVolume.ts` / `propVolumeRenderer.ts` and authored shape/material data elsewhere in Proto. A drawing alone cannot specify a closed cave rear, carved open north-facing entrance, volume depth or directional surface material. For a scenery request, separate the overhead print, source silhouette/material references, world-facing orientation and geometry integration task. Card illustrations use their own portrait crop and are not sprite rig input. Holocard originals and prompts belong to the sibling `Exploritaire-art` repository; `art:sync` currently concerns those assets, not a general sprite import pipeline.
