# Hero world exploration v1

Thirteen built-in `image_gen.imagegen` sheets extend Hero's existing world identity: `bound`, `leap`, `hurdle`, `mantle`, `climb90`, `uphill15`, `uphill35`, `downhill15`, `downhill35`, `spin180`, `roll`, `snuffle`, `yawn`.

Each sheet has four consecutive action exposures for eleven views: low front/front-quarter/profile/rear-quarter/rear, the same views from above, and overhead. Mirroring covers the opposite half-orbit. This is 44 poses per action and 572 poses total. Source images are 1448×1086; runtime atlases are 1536×1152, 8×6 cells of 192 px, with the last four slots unused.

## References and provenance

Every initial generation received these actual images:

1. `public/assets/runtime/ui/quests/hero-snuffling-berries-blue-paint-v3.png`: mandatory watercolor style; broad soft washes and sparse selective facial accents.
2. `public/assets/runtime/characters/hero/rig/watercolor/v3/hero-directions-low-body-v3.png`: Hero identity, anatomy, markings and low camera views.
3. `public/assets/runtime/characters/hero/rig/watercolor/v4/hero-directions-high-body-v4.png`: elevated view identity/anatomy.
4. `public/assets/runtime/characters/hero/platforming/suite-v1/hurdle.png`: action reference only.
5. `public/assets/runtime/characters/hero/platforming/suite-v1/ledge-climb.png`: action reference only.

Hurdle, mantle, leap, uphill15, downhill35 and snuffle received targeted ImageGen transparency corrections, referencing the original sheet and actual Hero berry painting. Their final generated alpha is retained. No background keying, recoloring, painting, alpha replacement or generated-limb reconstruction was performed in the packer.

Selected byte-identical masters, dark-ground review sheets, exact prompts/correction prompts, original generation paths and SHA256 digests are under `public/assets/sources/characters/hero/world-exploration/v1/`. The portable packing record is [hero-world-exploration-v1-packing.json](./hero-world-exploration-v1-packing.json). Runtime images are under `public/assets/runtime/characters/hero/world-exploration/v1/`.

`tools/pack-hero-world-exploration.ps1` crops at transparent gutters near the generated grid boundaries and applies one uniform registration transform to all four exposures in each view. The lowest planted exposure sits at pixel 190, with a transparent gutter. It never independently rescales individual animation frames. Source alpha remains untouched. View-specific source orientation corrections are recorded in `heroWorldActions.ts`; runtime mirroring follows the existing navigation rig's left-facing convention.

## Runtime behavior

`heroWorldActions.ts` separates action phase from camera view. `heroWorldDirector.ts` chooses fast gaits, jump exposures, signed-grade clips, quick turns and shuffled random idles. Old navigation/standing poses remain available as a loading fallback and for ordinary walking/crouching and special triple/side jumps. Idle rolls, snuffling and yawns begin after an 8–15 second pause, do not repeat until the bag is exhausted, and cancel on movement. Reduced motion holds explicit previews still and suppresses spontaneous idle animation.

`CastlePlatformMotion` turns the body over 0.18 seconds during a fast reversal while the previous velocity still carries Hero; normal collision sweeps continue through braking and acceleration. Slopes below 7° retain the original gait, 7–25° select mild hill art, and steeper grades select steep hill art. The degrees name the painted reference grade, not a new terrain walkability rule.

Climbing is opt-in geometry authoring: attach a `WorldScaffold` record to a pickable mesh's `userData.worldScaffold`, register that mesh in the scene's picking list, and supply world-space `from`, supported `to`, body `heading`, `kind: 'mantle' | 'climb90'` and optional speed. Direct clicks first use ordinary safe navigation to the base, then climb the explicit route. Missing landings are rejected. Cancellation or a blocked approach drops queued intent. This asset release does **not** mark every decorative tree vine climbable or add arbitrary-wall climbing. The preview includes a real vertical route and supported landing fixture.

`heroWorldTextures.ts` decodes on demand and retains at most four atlases, about 27 MiB of base RGBA GPU storage, without mipmaps. Failure retains the existing rig. World telemetry now includes action, frame, view, mirror, phase, heading, velocity, grade and scaffold progress. Config → Hero action preview selects every new clip.

### Physical-scale correction, 2026-11-12

The original runtime used an uncalibrated 1.55 m plane for every new clip/view. This enlarged painted silhouettes relative to the older world atlases, especially frontal/rear idle poses. `tools/calibrate-hero-world-scale.cjs` now derives checked-in `heroWorldScale.json` from the existing activities-v1 neutral paint dimensions and the new source packing metadata. Each clip/view gets one uniform physical scale for all four exposures. Climb/mantle retain their extended posture by using the corresponding bound body calibration. Both the live world and sprite preview consume the same scale. A regression test checks all 143 clip/view calibrations against the baseline and verifies phase changes never resize a clip.

Sentient overlap now defaults to a cyan-white glowing contour of the hidden actor projected onto the foreground sentient plane, using its current alpha crop, mirror, plane bounds and viewing-ray depth. It works in either Hero/Flurry order without exposing the hidden actor's full painted body. Display → Sentient overlap retains the original silhouette cutout option. The original cutout shader is preserved. A focused GPU check exercised both depth orders, confirmed unchanged pixels for non-overlapping entities, and checked cutout/outline produce distinct results with no page/shader errors (`artifacts/sentient-overlap-check.json`).

## Review and validation

Open `/tools/hero-world-exploration.html` on Vite for all clips, a full yaw/elevation orbit, phase scrubbing, animation pause, light/dark grounds, four-frame checkerboard strips, a quick-turn physics demonstration, a supported vertical climbing demonstration and selectable telemetry text. This preview reuses the actual action selector, controller and bounded texture cache.

- Reviewed all thirteen packed sheets on dark ground and the live preview on dark/checkerboard. Corrected translucent paper backing through ImageGen. Mechanical gutter crops prevent neighboring frame fragments from leaking across nominal grid lines.
- TypeScript typecheck passed.
- 24 targeted tests passed: existing platform motion/idles/directional rig plus quick-turn drift/collision, grade sign/thresholds, all 44 frame addresses per clip, orbit phase independence, idle cancellation/reduced motion and supported/rejected climbs.
- One isolated headless browser run decoded and checked all 572 poses, sampled low/high/overhead and both yaw hemispheres, verified quick-turn/climb telemetry and the four-atlas bound, and reported no page errors. Evidence: `artifacts/hero-world-exploration-browser.json`, `artifacts/hero-world-exploration-preview.png`.
- The focused corrective browser run passed the 44-frame leap gutter assertions and page-error check, then failed an optional screenshot step because Playwright rejected `.45` as an HTML range value. Browser validation stopped at the standing two-run limit. The standalone edge harness now ends after its assertions; that cleanup was not rerun, and no corrective screenshot is claimed.
- Vite, HTTPS tailnet and port-5178 tailnet book URLs returned HTTP 200; Tailscale reported Running/Online.

The browser check used the focused live renderer/controller preview. A fresh full World Tree fly-in and extended traversal playthrough were not part of that run. The generated art is four-keyframe animation; it does not claim continuous skeletal motion capture or new automatic vine placement.
