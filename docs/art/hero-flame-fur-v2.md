# Hero integrated flame fur v2

2026-10-24. Replaces Hero's three detached v1 flame stamps with a decomposition of the user-approved composite. No new flame artwork is generated in this pass. Mochi's three greenery assets and their placement are unchanged.

The approved composite is copied byte-for-byte to `public/assets/runtime/ui/holocards/motifs/v2/hero-approved-composite.png` (SHA256 `C2067920FBF8D0CB8AB01BF7F598FEA2DDD666E45BBB01C1E0EA4478567FEFEA`). The original Hero portrait is still SHA256 `5509C8CC2F0B70978AEF8071B358A6C9F422715D5E00F864E5A2A9F4B6FB4FC2`.

`src/proto/art/heroFlameFur.ts` records source rectangles, destination registration and root/topcoat masks. `HeroFlameFur.tsx` samples actual approved-composite pixels through SVG viewports. Each shoulder/paw patch retains a broad flame-to-fur transition. An original-Hero fur sample sits above its root with an irregular edge. The root blend fades inward and softens the sampling boundary; it does not recolor the source painting. The topcoat matches the original portrait's exact coordinate system. The composite pose differs slightly from the original, so local registration is an authored reconstruction, not an assertion that the two full paintings align pixel-for-pixel.

The original base, flame-fur patches and natural-fur topcoat form three rendering levels. Hero's original 1029×1529 aspect is used for registration. Flame tips receive bounded 0.6px relative motion per unit of depth (maximum 1.2px per axis), while the natural-fur overlap stays attached to the base. Foundation and reduced-motion views remain static. There is no idle animation. Three small mask filters are bounded to their individual patch regions; no per-frame image processing is added.

At `/proto.html?motifsbx`, Element motifs toggles the entire reconstruction; each flame-fur patch can be toggled separately, and Natural fur overlap exposes the topcoat for review. Strength controls the whole added patch, including its occlusion; switching motifs off restores the unchanged original. The large pre-existing flame in the original painting remains part of that base and is not removed by this work.

Typecheck passed. Headless checks passed at desktop/phone for source sampling, three flame-fur/occlusion pairs, master/overlap toggles, parallax, reduced motion and unchanged Mochi layers. Reviewed the composed captures and refined a visible wrist sampling edge before delivery. Evidence: `artifacts/actor-motifs-v1/hero-v2-*.png` and `hero-v2-check.cjs`.
# Paw silhouette correction

The paw overlay mask stops above the approved composite's toe anatomy. Its paw is registered differently from the original; including those lower source pixels creates an apparent extra toe. Keep the original toe silhouette visible with or without Natural fur overlap enabled. Only the upper flame/fur sample is composited.

