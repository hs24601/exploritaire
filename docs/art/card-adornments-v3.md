# Soft elemental adornments v3

Scenario 1002 selects the six asymmetric corner passes from the built-in ImageGen soft-brush iteration. Runtime `{nature,fire,water,air,earth,chaos}-v3.png` files are byte-for-byte copies of the corresponding `*-master-v3.png` source images. Full-frame alternatives remain `*-frame-study-v3.png` source studies; previous versions are preserved.

Exact prompts: `public/assets/sources/ui/card-adornments/soft-v3-prompts.json`. Nature maps to leaves, Water to waves, and Air to wind in that generation manifest. Chaos now uses the shared decorative image renderer and accessible affinity text, with no duplicate tableau glyph. Existing buried-card inversion, rank layout and pointer behavior are unchanged.

Validation: TypeScript passed; all six source/runtime pairs match byte-for-byte. Both focused headless runs decoded all six runtime assets and confirmed abundant clear and partially transparent pixels. The harness incorrectly required more than 100 fully opaque pixels (Fire has 2 and Water 17); it stopped before live-card assertions/screenshots. The harness now measures paint at alpha >=128 but was not rerun because the standing two-run browser limit was reached. Live-card layout and interaction remain unverified in this pass. The elemental suit rules suite passed 7/8 tests; its existing Hold/Dem hand expectation conflicts with the current Cir-only scenario baseline.

Nature v4 refinement: two modest, independently painted corner sprigs replace the dominant lower-left mass and extra right accent. Selected by the shared renderer only for Nature. Source: nature-master-v4.png; runtime: nature-v4.png; exact built-in ImageGen edit prompt: nature-v4.prompt.txt in the source folder. Previous versions remain available.
