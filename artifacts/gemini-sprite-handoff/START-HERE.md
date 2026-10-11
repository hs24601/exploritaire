# Gemini sprite artwork handoff

Prepared 2026-10-10 from the current Exploritaire Proto implementation.

Upload `reference-assets/actors/battle/*.png`, this document, `TECHNICAL-SPEC.md`, and `asset-manifest.json` to Gemini. Attach `reference-assets/actors/hero.png` for Hero identity. The bundle includes original generation notes and source-code snapshots under `reference-code/`; those snapshots are reference material, not a standalone runnable project.

## Copy/paste this prompt into Gemini

```text
You are the sprite art production partner for Exploritaire. Codex handles game development and rig integration; you handle artwork creation, consistency review, transparent cutouts and deterministic atlas packing. Build a discrete, repeatable workflow using the attached technical specification and existing sprites as references.

Our renderer is an articulated directional sprite renderer, not a skeletal 3D model or a frame-by-frame animation player. It cuts head, torso and hind regions from ONE coherent full-body drawing per direction and animates those regions. Never generate independently proportioned body parts for assembly. Do not change game code, invent unsupported joints, or claim your output is integrated into the game.

Begin by writing an asset brief: actor ID, species, identity references, markings on each anatomical side, neutral pose, palette, effective pixel scale, whether mirroring is acceptable, required views and intended rig category. If I have not supplied a new actor, ask which actor or pose to create; do not redesign existing actors by default.

Then run these stages separately, retaining approved outputs at each gate:
1. Identity/style: produce one complete neutral side view and approve its anatomy and pixel style.
2. Low directions: create 8 coherent full-body views in the prescribed order. Preserve identity, pose and scale; author both sides for asymmetric characters.
3. Elevated directions: create the same 8 views from about 55 degrees above the ground using the approved low artwork as an identity reference.
4. Overhead: create one true orthographic overhead view, nose pointing toward the top of the image.
5. Technical preparation: export individual transparent PNG frames; use deterministic image tools to verify alpha and pack the approved frames into atlases. Do not rely on image generation to achieve exact coordinates, exact gutters, or valid JSON measurements.
6. Delivery: supply low/high atlases, all individual frames, measured metadata, a labeled preview separate from production art, the generation prompts and a QA report. Mark any unmet requirement explicitly.

Use the attached TECHNICAL-SPEC.md for frame order and the distinction between existing runtime requirements and the proposed production packaging convention. The existing Hero sheets contain unused detached parts: those are historical artifacts, not a template to reproduce. Existing irregular packing is also not a target.

Artwork: crisp pixel clusters, stepped contours, readable dark outlines, restrained palette, consistent natural shading, complete ears/paws/tail, no blur or painterly texture. Genuine alpha transparency outside the animal and in gutters. No baked ground shadow, scenery, text, watermark, grid, border, checkerboard graphic or colored background. Labels belong only in the separate preview.

Preserve Hero as a female tricolor Australian Shepherd, black/tan/white, white blaze/chest/paws and floppy ears. An old generation note calls her a Border Collie; the current project baseline and approved identity take precedence. Preserve Mochi as a fluffy long-haired tortoiseshell CAT with asymmetric charcoal/copper/tawny markings, pointed tufted ears, dark paws, amber-green eyes and a dark plume tail; no white socks or dog anatomy.

If your selected tools cannot export real alpha, exact dimensions, packed PNGs or measured metadata, say so and deliver the approved individual art for a separate preparation step. Do not present approximate artwork as a technically validated atlas. No animation sequences are required for the current rig.
```

## Reusable image prompts

Replace bracketed fields using the approved brief. Attach approved identity art at every generation stage; attach Hero/Mochi as style references only when making another character.

### Neutral identity approval

```text
Production pixel-art game sprite of [ACTOR ID / SPECIES / IDENTITY]. Use the attached character references for identity and the existing Exploritaire sprites for pixel style only. One complete neutral standing animal, true left profile, nose screen-left, four correct legs, relaxed continuous back, proportional head and neck, entire tail visible. [EXACT MARKINGS AND SILHOUETTE]. Crisp clustered pixels, stepped dark outline, restrained readable palette, neutral asset shading. Match the reference's effective pixel scale. Real transparent PNG background. No ground, shadow, text, grid, props, blur, cropped anatomy or detached parts.
```

### Low directions

```text
Use the approved [ACTOR] neutral sprite and identity brief. Create eight COMPLETE coherent full-body drawings of the same actor in the same neutral standing pose, viewed at a low near-horizontal camera angle. Match scale, proportions, palette, outline and individual markings across every view. Four columns by two rows if generating a concept sheet; generous blank gutters and no overlap. Reading order: front; front-left quarter; left profile (nose screen-left); rear-left quarter; rear; rear-right quarter; right profile (nose screen-right); front-right quarter. Rear views show the back, not a frontal face. Both anatomical sides must preserve [SIDE-SPECIFIC MARKINGS]; do not mirror asymmetric markings. No detached heads, torsos or tails. Real transparency, crisp pixel art, complete paws/ears/tail, no text/grid/floor/shadows/background. Final packing will be measured in a separate step.
```

### Elevated directions and overhead

```text
Use the approved [ACTOR] low views as the identity and style reference. Create eight full-body views of the same neutral standing actor with the camera about 55 degrees ABOVE THE GROUND, looking down: back and head top visible, legs naturally foreshortened. Maintain anatomical side markings and consistent proportions. Order: front; front-left quarter; left profile; rear-left quarter; rear; rear-right quarter; right profile; front-right quarter. Additionally create one TRUE 90-degree orthographic overhead view, nose toward image top, tail toward image bottom. It shows the animal's complete ground footprint, not a frontal portrait. Nine cells in a 3 by 3 concept sheet if needed; no overlap, no detached parts. Same crisp pixel style and genuine transparency. No scene, shadows, labels, grids or checkerboard. Deliver separate approved cutouts for deterministic packing.
```

### Packing/alpha preparation instruction

```text
Treat the approved drawings as immutable raster artwork. With image-processing tools, preserve their pixels and proportions, verify actual alpha transparency, remove only unwanted background without eroding fur, and pack low/high sheets according to TECHNICAL-SPEC.md. Never redraw the actor to repair packing. Do not use smoothing. Report measured dimensions, integer crop rectangles and foot anchors, plus any uncertain alpha cleanup. Supply a labeled contact sheet separately. If exact preparation is unavailable, return individual PNGs and clearly identify the remaining preparation work.
```

## What to return to Codex

- Approved low/high PNGs and individual views, plus identity/style references.
- `metadata.json` with actual measured rectangles, dimensions, view IDs, transparency checks and ground anchors (see specification).
- Exact prompts, chosen versions, generation/edit history and QA findings.
- Actor proportions and intended relative world size; requested optional poses listed separately.

Codex will author and validate anatomical seams/pivots, register assets, wire the actor into its intended scene, and check runtime animation, world orientation and camera orbit. Adding files alone does not add an actor to the game.
