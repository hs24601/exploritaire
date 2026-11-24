# Pine directional-view draft v1

Created with the built-in ImageGen tool for the orbital-depth investigation. This is an exploratory atlas, not an approved production replacement or a reconstructed 3D tree.

References actually supplied to ImageGen:

- Style: `public/assets/runtime/ui/quests/hero-snuffling-berries-blue-paint-v3.png`, as required by ART.md.
- Subject identity and silhouette: `public/assets/runtime/environment/watercolor/v1/pine-relief-v1.png`.

Exact prompt: [pine-orbit-v1-prompt.txt](./pine-orbit-v1-prompt.txt).

The request was a four-column/two-row, eight-view atlas of one pine, ordered 0–315° in 45° increments, preserving broad merging watercolor washes and transparent backgrounds. The original generated master is retained at `public/assets/sources/environment/pine-orbit-v1/pine-orbit-atlas-v1.png`. Generated alpha is preserved. `tools/prepare-pine-orbit.ps1` performs only rectangular cropping into eight 384×512 PNGs and records registration metadata; it does not key backgrounds or repaint pixels.

Runtime color frames: `public/assets/runtime/labs/pine-orbit-v1/pine-0.png` through `pine-7.png`. Depth frames: `public/assets/runtime/labs/depth-relief/pine-orbit-0-depth.png` through `pine-orbit-7-depth.png`. Depth is estimated independently for each generated view using the existing offline authoring tool. Regenerate with `node tools/depth-authoring/bake.mjs pine-orbit`.

Review: atlas and individual front/opposite views were inspected. Broad watercolor foliage, grouped interior shadows, loose olive tips and opaque trunk are maintained. The first frame was composited over black and white for alpha review; no rectangular painted backing or keyed fringe was visible. Blank regions contain arbitrary RGB under zero alpha, so a viewer that ignores PNG alpha misleadingly shows a green backdrop. The game shader respects alpha.

Limitations: frames contain different branch silhouettes but are AI-authored approximations. They are not verified views of one physically consistent tree. Interpolation can dissolve or double branch edges rather than move a branch continuously around the trunk. The lab exposes view blending so this can be compared against discrete view changes. This must be judged visually before deciding whether additional coordinated art, layer correspondences or a real foliage-card model is needed.
