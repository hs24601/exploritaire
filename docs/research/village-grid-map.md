# Village grid map: design for review (2026-11-23)

Eric's brief: reimagine `village.html` around a **map screen** like the earlier `?city` table view, built on a **square grid** (Eric chose squares, 2026-11-23). The Forest, Berry Patch and Quarry are graphical features on the map. Tapping one shrinks the map to a minimap and shows that surface's puzzle. Nothing is built yet; this is a proposal for review.

## 1. The map

- **One square grid holds everything**: land features, buildings, paths and the gate. The slice starts at **9 × 6 tiles**, with fog beyond it. Rank-ups clear fog and add a ring of tiles, which is the "unlocked land" moment.
- **Features are multi-tile art, not boxes.** Each surface covers a footprint, for example Forest 3×2, Berry Patch 2×2 and Quarry 2×2 (locked behind fog until Village rank). It's drawn as one painted shape with a soft edge that bleeds a little into the tiles around it, so the grid doesn't read like a spreadsheet. Grid lines are faint, and only sharpen while you're placing a building.
- **Each feature has one node**: a marker tile with an icon and a small status chip, like `Forest · Forestry 3` with a daylight cost. Tapping anywhere on the feature works, but the node is where the eye goes.
- **Buildings sit on single tiles** in the open land between features. Combos use the four tiles that share an edge, and diagonals don't count. A combo is drawn as a short gold link across the shared edge (the same one used now).
- **Feature-adjacency bonuses** are new, and only possible on a map. They are provisional:
  - Woodshed touching the Forest: +1 lumber per felled tree.
  - Drying Rack touching the Berry Patch: food doesn't spoil.
  - Lantern Post touching the Quarry: the first stock card is free.

  This turns "where do I build?" into a real choice.
- **The gate** is an edge tile with a path into the village. Wanderers wait on it as small standees (existing portraits in a round frame). Tapping one opens the same Welcome card as now.
- **The HUD keeps today's frame**: daylight bar and clock, resources, appeal, and Rest. The left rail goes away, because the map replaces it.

## 2. Map to puzzle (the minimap transition)

1. Tap a feature. Its node pulses once, and the map scales and slides into the **top-left corner as a minimap** (about 200 × 130 px on desktop) over about 350 ms.
2. The freed space becomes the surface screen: the tableau, plus the compact Output strip (run gain, stored, mastery, Leave).
3. The minimap keeps the active feature highlighted and shows a "you are here" ring. **Tapping the minimap**, or pressing **Leave**, plays the reverse transition. Resources then fly from the feature to the HUD counters.
4. While a run is active, the other features on the minimap are dimmed. One run at a time, as now.
5. The transition is a transform on one element, so there's no reflow. Reduced motion becomes a crossfade.

## 3. Layout at each size (no scrolling anywhere)

The map's tile size is computed from the space available: tile = min(width ÷ columns, height ÷ rows). That way the whole grid always fits, with no scroll and no pan.

| Screen | Map view | Puzzle view |
| --- | --- | --- |
| Desktop 1912 / 1280 | Map fills the stage. A side drawer on the right holds the Build list and Kin, collapsed to icon tabs by default. | Minimap top-left, tableau centre, Output column right |
| Fold 7 inner (884 × 1000) | Map on top, drawer becomes a bottom sheet with tabs | Minimap top-left, tableau below, Output strip at the bottom |
| Fold 7 cover (412 × 915) | Map rotates to **6 × 9** (portrait), and Build/Kin open as full-height sheets from a bottom bar | Minimap as a small strip at the top, tableau, Output strip |
| Landscape covers | Map 9 × 6, drawer as an overlay sheet | Minimap top-left, board side by side (as now) |

Rotating the grid for portrait is a view transform only. Rules use fixed coordinates (the shared `GridCoordinates` convention), so a tile keeps its identity.

## 4. Building on the map

- **Drag** a building from the Build drawer onto an empty land tile. As a backup, tap a building, then tap a tile. Valid tiles get a faint outline only while you're placing. That's placement feedback, not move hints.
- Before you drop, a ghost preview shows any combo and feature bonus it would create, for example "+2 appeal · Hearth".
- Tapping a built tile opens a small inspect card with Take down.

## 5. What carries over unchanged

Golf rules, all three surface twists, the daylight costs (2 min a play, 15 min a stock card, 15 min to walk out), kin, nightfall, ranks and save. The walk-out cost could vary by distance from the village centre (for example 10 to 25 min), which gives the map's layout meaning. That's a question below.

## 6. Questions for Eric

1. **Walk-out cost by distance:** should features farther from the village cost more daylight to reach? I'd say yes, from 10 to 25 min.
2. **Feature-adjacency bonuses** (section 1): in for this pass, or leave the combos building-only?
3. **Fixed or placeable features:** should the forest, patch and quarry be fixed in place (I'd recommend this), or should you choose where some land features go?
4. **Art:** placeholder painted shapes and icons for now, reusing existing watercolour overheads where they fit (`environment/watercolor/v1/woods-overhead`, `berry-patch-overhead`, `stone-spill`)?
