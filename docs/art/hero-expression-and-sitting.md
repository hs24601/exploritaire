# Hero sitting and curious expression

Built-in ImageGen edits/additions, 2026-10-10. Hero has eight authored sitting views at each elevation and a true overhead view. She sits when idle, stands while travelling/acting, and retains her explicit sleeping pose at bedtime. World heading is retained across pose changes.

All Hero artwork with visible brows received the gentle curious/inquisitive expression correction: standing atlases (including detached source heads), single standing Hero, sitting views, sleeping source atlas and derived cutouts, quest art, and the authoritative holocard plus its synced game copy. Rear views without visible eyebrows retain their identity and pose.

The exact prompts, selected output names, preparation and rejected variants are in `public/assets/actors/battle/hero-sitting-generation.json`. Unmodified pre-edit references are retained in `artifacts/hero-art-before/`. Those historical backups and generated tool originals are not current game artwork.

Runtime source metadata is in `hero-sitting-layout.json`; `src/proto/heroSittingSprite.ts` authors anatomical seams/pivots. `tools/prepare-hero-sitting.cjs` packs unchanged cutouts with measured bounds and transparent gutters. It also extracts overhead prints for standing/sitting. The current idle/travel policy is explicit in ProtoMap; the shared rig switches pose on existing instance joints, materials and cached geometry.
