# Hero platforming sprite suite v1

Generated with built-in ImageGen using the approved sitting sprite as the key identity/style reference and ART.md as the art direction. Contains **19 eight-frame clips, 152 authored poses**, plus 14 derived playback sequences (33 selectable animations total).

## Review

Open `/tools/hero-platformer-sprites.html` on the project server. The preview provides playback, frame stepping, speed, left/right mirroring, backdrop changes, event readouts and editable per-frame pivots. Export manifest saves pivot edits; it does not overwrite disk automatically. Contact sheets are in `artifacts/hero-platform-suite-v1/`.

## Contents

| Clip | Default FPS | Playback |
| --- | ---: | --- |
| idle | 8 | Loop |
| sit | 8 | Loop |
| walk | 12 | Loop |
| run | 16 | Loop |
| crouch | 12 | Transition |
| crawl | 12 | Loop |
| jump | 14 | Takeoff to apex |
| fall-land | 14 | Fall, landing, recovery |
| hurdle | 14 | Vault |
| ledge-hang | 8 | Loop |
| ledge-climb | 8 | Mantle |
| wall-slide-jump | 12 | Slide and push-off |
| brake-turn | 12 | Brake, turn left |
| hurt | 12 | Flinch and recovery |
| defeat | 10 | Tumble and rest |
| interact | 10 | Sniff and bark |
| celebrate | 12 | Happy reaction |
| swim | 12 | Paddle loop |
| sit-stand | 12 | Sit to stand |

Derived sequences: stand-up, crouch-hold, jump-prepare, jump-rise, jump-apex, fall, land, wall-slide, wall-jump, brake, turn, down-hold, sit-down and dash. These reuse master frames; they are not additional generated artwork.

## Files and registration

- Runtime: `public/assets/runtime/kin/hero/sprites/platforming/platforming-motion-library/`.
- Each `<clip>.png` is a horizontal **3072 × 384** atlas with eight **384 × 384** cells. Individual transparent PNGs are in `frames/<clip>/00.png` through `07.png`.
- `manifest.json` includes atlas rectangles, normalized pivots, frame durations, facing, loop settings, suggested contact events, source bounds and validation statistics.
- Original selected ImageGen sheets are retained byte-for-byte in `public/assets/sources/kin/hero/sprites/platforming/platforming-motion-library/`. `reference.png` is the approved sitting art. Rejected interaction-halo and seated-standing-idle attempts are retained in `rejected/` for provenance and are not runtime artwork.
- Exact prompts and reference roles: `docs/art/hero-platform-suite-v1-production.json`, also copied as source `prompts.json`.

Canonical movement faces right. Mirror at runtime for left movement; brake-turn intentionally includes a turn to left. Frames are in-place: game physics supplies displacement, jump trajectories and collisions. Tail/flame effects remain separate.

Packing uses a uniform scale per source sheet and translation onto transparent cells. It does not repaint the source or remove pale paint. Feet pivots use the painted mass and contact baseline; airborne pivots use the visual centroid, not a skeletal joint. Ledge-climb pivots have a hand-reviewed contact pass. **Treat these as visual starting points and calibrate ledge contacts/colliders in the actual level.** Timing and contact cues are suggestions, not collision authority. As generated animation, some painted markings and silhouette details vary between poses; the preview exposes every frame for review.

## Player

`player.mjs` supplies a framework-independent animation clock and Canvas renderer. The preview imports the matching copy in `tools/hero-platform-player.mjs`.

```js
import { loadHeroPlatformSuite } from '/assets/runtime/kin/hero/sprites/platforming/platforming-motion-library/player.mjs';
const suite = await loadHeroPlatformSuite('/assets/runtime/kin/hero/sprites/platforming/platforming-motion-library/');
const animator = suite.createAnimator();
animator.play('run', { mirror: false });
const atlas = await suite.image('run');
// Each update, using elapsed milliseconds:
animator.advance(deltaMs);
animator.draw(context, atlas, actorX, actorY, 0.5);
for (const cue of animator.events()) handleVisualCue(cue);
```

When changing animations, load the corresponding atlas and retain the physics actor position. Non-looping clips hold their last frame. Call `play(id, {restart:true})` to replay. Use the phase aliases to separate jump ascent, airborne hold, descent and landing according to physics.

Existing book/combat gameplay has not been switched to this suite.

## Rebuild and validation

From the project root (Node and Playwright Chromium required):

```sh
node tools/pack-hero-platform-suite.cjs
node tools/hero-platform-contact-sheets.cjs
node tools/hero-platform-suite-check.cjs
node tools/hero-platform-suite-browser-check.cjs
```

The browser check starts its own temporary local static server. Checks cover all 152 exported frames, transparent source margins, opaque painted cores, clip/alias timing, reverse playback, looping, mirroring, pivot editing and browser errors. Desktop/mobile preview screenshots are saved under `output/hero-platform-suite-v1/`.

The downloadable archive contains runtime assets, selected masters/reference, prompts, this guide, preview and player. Extract it and serve its root with a local static HTTP server (for example `python -m http.server 8000`), then open `http://localhost:8000/tools/hero-platformer-sprites.html`. Project rebuild scripts remain in the repository.
