# Asset library

Organize files by lifecycle, then purpose, subject, representation/style and version.

| Folder | Contents |
| --- | --- |
| `runtime/characters/<character>/` | Rig sheets, poses, sleeping art and expressions. Expressions subdivide into heads, faces and emojis; styles and versions follow the use. |
| `runtime/environment/<style>/<version>/` | Terrain floors, overhead prints, standees and scenery cutouts. |
| `runtime/ui/` | Ability illustrations, holocards and quest art. |
| `runtime/items/<item>/` | Shared item artwork such as manaberries. |
| `runtime/cinematics/` | Multi-character scene illustrations. |
| `runtime/backgrounds/`, `runtime/textures/`, `runtime/effects/` | Parallax backgrounds, surface textures and effect imagery. |
| `runtime/fonts/`, `runtime/audio/` | Font files/licenses and sound effects. |
| `sources/` | Original sheets, generated inputs and production provenance, grouped by the corresponding domain. Older production batches retain descriptive batch names. |
| `deprecated/pixel/` | Retired pixel artwork, its original source sheets and legacy metadata. Existing fallback/helper references remain supported. |

Use descriptive filenames and keep approved versions; never overwrite artwork to repurpose it. Keep source images separate from runtime exports. Registration/atlas JSON stays beside the runtime sheet when consumers need it. Shared files belong to their purpose, not a miscellaneous art bucket. New character art belongs under its character, not a battle-wide folder.

Pixel retirement describes the asset lifecycle. It does not authorize silently removing an unconverted companion or scenery fallback. Gameplay continues to use its approved watercolor presentation.

The complete old-to-new inventory is in `docs/art/asset-migration.json`. Runtime code and tools use the new paths directly. `tools/sync-art.mjs` translates the sibling art repository's legacy manifest targets into the new UI paths so syncing cannot recreate `assets/art`.

Exploratory renders and test screenshots stay outside this library in `output/` and `artifacts/`; historical handoff snapshots in `docs/gemini-sprites/` retain their own packaging.
