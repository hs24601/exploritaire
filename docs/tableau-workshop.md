# Proto tiles and tableaus

Open `/tooling.html`. It runs the actual Proto map with the shared tile editor already open in the authored-map sandbox. The former generic Kin/ability/encounter editor is no longer exposed on this page.

Select a tile on the map or with **Choose tile**. The workspace includes:

- **Tiles:** identity, position and footprint; travel costs/card counts and directional passages; population and gathering tuning; flags/discovery/arrival rules; road prints and scenery lights.
- **Terrain defaults:** shared travel defaults, separate from per-tile overrides.
- **Tableaus:** reusable travel layouts, stack grouping, fixed/random ranks, dragging, rotation/layers, seeded play testing and terrain-type assignments. The selected tile determines the contextual terrain assignment.

Under **Resources**, the sample tableau comes from Proto's actual tile materialization and shared card renderer. Woods use resource density and deal size. Dense berries and paths use their existing generators; sparse berries grant their finite harvest through travel without gathering. The den uses rest, ponds use fishing, and passages keep their crossing rules. Scripted days can replace gathering deals with their authored finite puzzles.

**Apply tiles to playtest** changes this running Proto session. **Close · playtest applied data** resumes it, and the pencil reopens editing. Unapplied tile edits are discarded on close. **Save tile data** writes `src/data/protoTiles.json` through the existing trusted development endpoint. Import/export uses the same validated authored schema and excludes card removals, ranks, resource totals and progression.

Travel layouts have separate **Apply layouts to playtest**, **Save layout data**, import/export and draft recovery. A layout assignment applies to all tiles of its terrain type, with sparse berries as a separate target. Layout apply is browser-local for new journeys; saving writes `src/data/tableauLayouts.json`. Clear the layout playtest override to return to saved defaults. Random A–K samples are deterministic per seed and may need a normal rank reset in gameplay.

The tool intentionally uses Proto's supported tile data and generators. It does not expose unrelated legacy entity catalogs or claim those ideas are shipping features.
