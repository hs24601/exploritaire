# Hero awake-face and proportion refresh

Combat v3 replaces the rejected sleepy v2 faces. Built-in `image_gen.imagegen` generated a new eleven-view ready master from the original navigation identity and actual Hero berry painting, then separate eleven-view phases for approach, pre-lunge bow, leap and yawn. Ready holds the same registered paint in four atlas slots rather than introducing expression drift. Leap's final recovery reuses this fully standing pose: the generated landing gather looked seated and is archived under `world-combat/v3/rejected/`. Other moving actions retain four distinct authored exposures. Existing restrained runtime breathing remains available.

The face uses open amber eyes, pricked ears, the original short muzzle and a closed neutral mouth. The yawn opens the lower jaw while preserving the upper muzzle and skull. This is a new raster generation, not sharpening, recoloring, procedural face replacement or enlargement of the rejected sprites.

- Combat runtime: `public/assets/runtime/characters/hero/world-combat/v3/`.
- Yawn runtime: `public/assets/runtime/characters/hero/world-exploration/v2/yawn.png`.
- Original-alpha masters, per-phase prompts, actual reference roles and SHA256 digests: corresponding `public/assets/sources/characters/hero/` family manifests.
- Portable complete prompt set and selected original generation paths: `artifacts/hero-world-refresh-generation.json`.
- Contact review: `artifacts/hero-world-refresh-review.png`.

Each source has a 4×3 grid containing eleven views, with the last slot empty. A pose has four times the source area of the prior 8×6 grid. The packer only crops, uniformly registers and downsamples the generated alpha: no segmentation, alpha keying or fur repaint. Runtime atlases are 2048×1536 with 256 px cells; existing exploration actions retain their independent 192 px format. Both world and preview derive UVs from the selected clip's atlas dimensions. The four-texture cache remains bounded (at most 48 MiB of base RGBA storage for four large atlases, without mipmaps).

Scale calibration now compensates the selected clip's packing transform, rather than inheriting a differently packed combat-ready transform. Seated roll entry uses the existing seated Hero's physical footprint. Climbing/mantling retain the bound pose's anatomical scale while compensating their own packing transform. Every exposure in a clip/view shares one physical size. The packer requires floating-point scale selection and checks fitted bounds so large sources cannot crop ears or paws through integer rounding.

Rebuild:

```powershell
tools/pack-hero-world-phases.ps1 -Family world-combat/v3
tools/pack-hero-world-phases.ps1 -Family world-exploration/v2
node tools/calibrate-hero-world-scale.cjs
tools/review-hero-world-refresh.ps1
```

The live orbit/phase preview is `/tools/hero-world-exploration.html`; portals gameplay remains `/portals.html`. Earlier masters and runtime versions remain archived. This refresh changes presentation and calibration, not combat rules, pause behavior or navigation.

Validation: TypeScript typecheck and 15 focused tests passed, covering all clip/view physical calibrations, phase-stable scale, seated roll proportions, mixed atlas sizes, orbit addressing, movement/director behavior and combat awareness. The isolated live-renderer check decoded all five refreshed atlases (220 slots) plus the existing roll atlas, checked occupied frames, transparent perimeter gutters, actual versioned URLs and the four-texture limit, with no page errors. Front ready/yawn were visually reviewed in the renderer on dark/checkerboard grounds; source/packed contact sheets were reviewed separately. The local portals and Tailscale root returned HTTP 200. This is focused renderer verification, not a fresh full-world portal/combat playthrough.
