# Flurry expression overlays v2

Twenty individually generated transparent face overlays, made with the built-in
ImageGen tool. Every call uses the actual Hero berry painting as paint-style
reference and the registered Flurry face as identity/placement reference.
The neutral face becomes the registration reference for subsequent variants.

- [Composite review sheet](../../public/assets/sources/ui/stickers/snowflake-expressions-v2/contact-sheet.png)
- [Originals, exact prompts, reference roles and hashes](../../public/assets/sources/ui/stickers/snowflake-expressions-v2/manifest.json)
- Runtime: `public/assets/runtime/ui/stickers/snowflake-expressions-v2/faces.png`

| Category | Frames |
| --- | --- |
| Kin mood coverage | neutral, curious, happy, sad |
| Extra moods | surprised, delighted, worried, determined, sleepy, content |
| Winks and blinks | wink-left, wink-right, blink-half, blink-closed |
| Directional looks | look-left, look-right, look-up, look-down, look-up-left, look-up-right |

Original 1254-square generated PNGs retain their alpha and registration. The
runtime atlas mechanically downsamples each entire canvas into a 384-square
cell, four columns by five rows (1536×1920), without inventing or repainting
features. `tools/pack-flurry-expressions.ps1` packs the retained sources and
creates the light/dark composite review sheet. No existing v1 image is replaced.

`flurryExpressions.ts` owns weighted mood/glance selection and blink timing.
World and loose-sticker faces share that rig. Glances hold roughly 1.2–3.2 s;
moods 2.5–6.5 s; playful winks are brief. Blinks use half/closed/half frames over
180 ms, with varied intervals and occasional double blinks. The eye half swaps
independently to preserve the current mouth and cheeks. Applied sticker prints
are neutral; reduced motion freezes a neutral face. The world face remains a
normal mapped material for alpha-aware point-to-click selection.

World stickers rotate around their own centers, roughly one turn per 96 s.
The camera no longer dictates their orientation; face parallax remains a small
independent offset. Reduced motion holds a fixed orientation and neutral face.
