# Hero combat focus v2

The active four world-combat sheets now use soft natural amber eyes, relaxed brows and a neutral closed mouth. Focus comes from gaze and ready posture. The added dark eye rings, heavy sockets and scowling brow from v1 are removed. Standing readiness, approach gait, pre-lunge bow and leap retain their poses and eleven-view orbit layout: 176 exposures in total. Sitting remains suppressed near enemies.

Generated through built-in `image_gen.imagegen`, editing each actual v1 source sheet with the actual Hero berry painting as the style/eye-treatment reference. No procedural eye replacement, recoloring, global filter or alpha keying was used. Each selected master is copied byte-for-byte with its generated alpha; runtime packing only crops/registers those images using the existing mechanical packer.

- Active runtime: `public/assets/runtime/kin/hero/sprites/world/combat/refined-combat-cycle/`.
- Masters, dark-ground reviews, exact prompts/references and source SHA256 digests: `public/assets/sources/kin/hero/sprites/world/combat/refined-combat-cycle/manifest.json` and `generation.json`.
- Portable prompt set: `artifacts/hero-combat-v2-generation.json`.
- Packing record: [hero-world-combat-v2-packing.json](./hero-world-combat-v2-packing.json).
- [Before/after body and eye comparison](../../public/assets/sources/kin/hero/sprites/world/combat/refined-combat-cycle/focus-comparison.png).
- Live orbit/animation preview: `/tools/hero-world-exploration.html`.

The v1 family remains archived. The shared atlas loader now resolves combat actions to v2, and physical-scale metadata is regenerated against the existing neutral Hero baseline. All four frames of a clip/view still use one uniform body scale, with serious-ready retained as the fallback so loading never switches to relaxed sitting artwork.

Rebuild with `tools/pack-hero-world-exploration.ps1 -Generation artifacts/hero-combat-v2-generation.json -Family world-combat/v2`, followed by `node tools/calibrate-hero-world-scale.cjs`.

Pause is now entirely manual in the portals game. The window-blur pause handler was removed; Pause/Resume, Escape and controller Start/Menu remain. Existing focus-loss input cleanup does not pause the world clock. Browser-native background throttling does not change the game's pause state.

Validation: typecheck and eight focused animation/scale/awareness tests passed. One isolated browser run loaded all four active v2 atlases, verified their size and calibrated scales, and confirmed blur, document visibility and controller connection events leave the clock advancing. Mouse Pause/Resume, Escape and controller Start/Menu still manually pause/resume. No page errors were reported. Evidence: `artifacts/hero-focus-v2-check.json`, `artifacts/hero-focus-v2-preview.png`. The comparison and original-alpha sheets were visually reviewed on dark/checkerboard grounds. This check used the actual controls and shared live sprite renderer in focused fixtures, not a fresh full-world fly-in.
