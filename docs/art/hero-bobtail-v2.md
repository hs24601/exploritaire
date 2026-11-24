# Hero bobtail and optional ethereal flame

Built-in ImageGen edits, 2026-10-13. Hero has a natural charcoal furry bobtail. The user's photo is an anatomy reference; the existing sprites remain the identity, palette, pose and watercolor style reference. Historical sources remain intact.

## Assets

- Eight body-only Paint atlases: `public/assets/runtime/characters/hero/rig/watercolor/v2/hero-*-bobtail-v2.png` (standing low/high, sitting low/high, four-phase walking low/high, flinch and down).
- Two body-only sleeping sprites: `public/assets/runtime/characters/hero/sleeping/watercolor/v1/hero-sleeping{,-topdown}-bobtail-v2.png`.
- Independent base, tongue and tip sprites: `public/assets/runtime/characters/hero/rig/watercolor/v2/hero-flame-pieces-v2.png`.
- Unnormalized body edit sources: `public/assets/sources/characters/bobtail-v2/`.
- Generation provenance: `hero-bobtail-v2-generation.json`. Canvas normalization report: `hero-bobtail-v2-packing.json`. `tools/prepare-hero-bobtail.py` packages generated images onto the existing atlas dimensions. Existing UV rectangles and joints remain the runtime contract.

The current conversion covers Paint. Historical Pixel sprites and combined Hero/Mochi cuddling art retain their existing artwork. Card portraits are outside the world-sprite rig.

## Runtime contract

Game settings → **Hero flame tail** changes the live session's Paint effect visibility. No gameplay state or spirit trigger is implied. The shared rig creates three independent flame pivots under the `hind` joint, using one shared atlas. Every current pose and camera tier uses the same effect. The reduced-motion pose holds all three pieces still. Den prints and the painted interior use `RestFlameTail`, sharing the same atlas and visibility state, with CSS motion disabled under reduced motion.

`DirectionalSpriteInstance.setFlameTailVisible(boolean | undefined)` overrides visibility per instance; `undefined` restores the shared setting. `instance.flameTail.socket.getWorldPosition(target)` supplies the current emitter position. `instance.flameTail.intensity` supplies bounded flicker multiplied by actor opacity and becomes zero when hidden. It does not allocate lights. A future scene-light consumer should also gate emission by actor/root visibility and its own light budget. Flame materials are unlit and independent of the body's environment sample. Shared body tint and hit flashes continue to apply to body anatomy. The den SVG overlays have no Three.js world socket.

## Prompt set

Body edit: “Production sprite atlas edit. Preserve exact canvas dimensions, all individual dog positions, sizes, poses, registration, expressions, paws, markings, watercolor brushwork and transparent gutters. Remove all orange/yellow ethereal flame tails on every dog; replace long furry tails with a tiny natural charcoal furry bobtail nub close to the rump, like a naturally bobtailed Australian Shepherd. Reconstruct fur where fire overlapped. Do not move, rescale, rearrange or redraw the rest of any dog. Same number of figures in the same cells and same blank margins. Transparent PNG, no background, glow or text.” The standing low edit also used the user's photo for bobtail anatomy.

Sleeping edit: preserve the sleeping pose, framing, expression and style; remove spectral flame, glow and backdrop; show a tiny natural bobtail; retain complete ears and paws on transparent alpha.

Flame atlas: three separated watercolor flame cutouts in one horizontal row: broad curved base, tall S-curved tongue, small curling tip. Warm peach/coral/orange/pale gold dabs with transparent wash edges, generous gutters, no dog, scenery, text, background or glow halo.

## Validation

- Focused sprite tests and the dedicated `heroFlameTail.test.ts` check cross-pose attachment, independent animation, visibility, body invariance, opacity, emitter movement and reduced motion.
- `tools/hero-bobtail-playwright.cjs` checks live den toggles with mouse/touch, settings layout at 1280×720 and 1912×914, and renders the shared rig's standing/sitting/walking/flinch/down views with flames on/off, elevated and OTT views. Captures are in `artifacts/hero-bobtail/`.
- Typecheck and production build.
