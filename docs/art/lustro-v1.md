# Lustro v1 — flame sticker and combat hand

Lustro is an upright, squat sibling of the existing Fireball painting, using the supplied compact flame image only for silhouette. The supplied face illustration directs expression geometry only; its background, flame repainting, and rosy cheeks are excluded. The actual Hero berry painting was passed as a style-reference image in both built-in ImageGen calls.

## Assets and provenance

Runtime: `public/assets/runtime/ui/stickers/lustro-v1/`.

- `body.png`: original-alpha generated transformed painting, byte-identical to the saved generated body master.
- `faces.png`: nine mechanically registered transparent expression overlays in a 3×3 atlas, 384px per tile.
- `face-{id}.png`: the same registered overlays as individual images, including the confident overlay used by the charge paint-in compositor.

Sources: `public/assets/sources/ui/stickers/lustro-v1/`. This includes untouched generated masters, both supplied reference images, exact built-in prompts/reference roles in `prompts.json`, source/runtime SHA-256 digests, alpha ranges and per-cell registration in `manifest.json`. Body and face masters are 1254×1254 RGBA. Both have alpha spanning 0–255. Packing uniformly scales each face's original-alpha feature bounds to half the tile width, centers it, and aligns the mouth baseline at 300px; there is no color key, recoloring, cheek removal filter or flattened paper backing.

Expressions: confident, happy, determined, surprised, content, sad, wink, half blink and full blink. No expression has rosy cheeks. The body does not change between expressions. A full contact sheet is saved at `output/lustro-expressions-review.png`.

Reusable APIs: `src/sticker/LustroSticker.tsx` and `src/sticker/lustroExpressions.ts`. `LustroSticker` accepts a `face` expression ID. This authors a game sticker; it does not silently add world inventory ownership.

## Integration

`?combat` replaces the Fireball hand slot with Lustro (`lustro` ability ID), retaining fire damage, the four-receipt gate, power hooks, paint transfer and tracked meteor casting. The upright painting has its own registered four-cornerstone layout. Card/constellation paint-in composites the approved confident face over the body, preserving square registration instead of stretching it into the former diagonal fireball.

All four hand cards now use the shared `TradingCard` spring, pointer/gyro calibration, foil/glare and `HoloLenticularCoating`. Painted scenery, sticker bodies and faces remain separate depth layers. Bite reuses its existing authored jaw-frame and GPU/DOM lenticular renderer. Lustro selects discrete signed lateral expressions; reversal retraces exposures, a stationary angle stays still, and vertical tilt does not select a new expression. The shared global toggle and remembered optics strengths apply. Reduced motion and low effects keep the ready expression still. Native hand buttons retain selection, pointer capture, quarter-size translucent ghosts and foundation targeting. React roots and Bite resources are released when the hand closes or charging begins. An optional generic `paused` property on `TradingCard` allows the native scene to freeze presentation without introducing a second spring.

The existing `configureFireball` tuning API continues to control Lustro's inherited meteor effect; its internal implementation/module names remain compatible.

## Validation

Visual review covered the body and nine expressions at full and card sizes, no cheek pigments, transparent surroundings, readable face above rules, and separate planes. TypeScript and 17 spell/cinematic tests pass. Headless browser checks pass for signed lateral reversal, vertical stability, independent parallax, shared toggle, pause/resume, reduced motion, injected gyro, native drag/charging/casting, narrow layout, effects-off stills, and real Bite WebGL context loss/recovery. Automated checks and screenshots live in `tools/woods-lustro-hand-check.cjs` and `output/lustro-*`. Physical-device gyro behavior still needs a real device; automated gyro checks inject orientation readings.
