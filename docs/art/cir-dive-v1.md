# Cir meteor dive study

Eight authored watercolor poses from the accepted storybook v3 phoenix: Gather, Fold, Tuck, Ignite, Meteor, Unfurl, Recover, Rise. The broad gold-orange train and white-hot breast belong to the paintings, not a procedural replacement for the approved art.

`/proto.html?cirsbx` or `/?cirsbx` plays a 2.2-second accelerating diagonal dive. Disable Diving path to inspect the wing/tail motion in place. Pose buttons and the progress slider stop playback for review. Reduced-motion preference starts on the still Meteor pose, disables playback and travel, and retains manual pose review. A hidden document does not advance the clock.

This prototype is isolated from live combat and the ordinary holocard idle presentation. The portrait and current mechanics remain unchanged. New animation playback is requested art scaffolding, not a universal idle-animation policy.

The original built-in ImageGen output and exact prompt live in `public/assets/sources/keru/cir/dive/v1/`. `tools/prepare-cir-dive.mjs` isolates the eight connected silhouettes, preserves their source paint and alpha, registers measured beak anchors at a common scale, and packs guttered 512px cells into a 4×2 atlas. Detached source flecks are omitted to prevent neighboring-frame contamination. `packing.json` records source bounds and anchor measurements.

Validation: TypeScript passed. Headless browser smoke checks cover pose changes, playing, pause/replay, seeking, 390px mobile fit, reduced-motion still/manual poses, background toggle and page errors. `tools/cir-dive-smoke.mjs` saves desktop/mobile captures and 48 progress samples in `artifacts/cir-dive-v1/`. Runtime packing validates real alpha and near-opaque cream paint; sprite trim generation passes.
