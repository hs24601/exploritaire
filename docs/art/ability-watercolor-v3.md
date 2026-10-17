# Enemy-free combat ability paintings

Built-in ImageGen edits replace the seven combat paintings: Nip, Bite, Takedown, Vice Grip, Scratch, Claw and Lacerate. Each contains only the acting friendly character. Removed opponents, slime bodies/faces, stretched gel, droplets, splashes and liquid ribbons are replaced with quiet woodland washes. Hero demonstrates nip, bite, pounce and braced grip poses; Mochi demonstrates distinct paw-swipe actions. All retain the approved soft diffuse v2 watercolor palette and broad merged washes.

Runtime assets: `public/assets/art/abilities/watercolor-v3/{nip,bite,takedown,vice-grip,scratch,claw,lacerate}.webp`. Full generated PNGs: `public/assets/art/abilities/sources/watercolor-v3/`. Prompts and source/output provenance: `ability-watercolor-v3-generation.json`. Rebuild with `node tools/prepare-ability-watercolors.cjs v3`.

Fetch and Dig keep their enemy-free v2 paintings. The shared ability lookup supplies the replacements everywhere, including playable, held, compact/jumbo and actor-loadout cards. Historical paintings remain preserved. Gameplay rules, costs, text and interactions are unchanged.

Validation: visually inspected every generated combat painting and the all-nine in-game card gallery for enemy/slime removal. All nine images decoded; desktop compact/jumbo inspection and layout checks passed with mouse/touch at 1280x720 and 1912x914. Typecheck passed. Evidence is retained in `artifacts/ability-watercolor-v3/`.
