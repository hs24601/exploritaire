# Village isometric sprites: authoring convention

Status: first slice, 2026-11-27. The isometric map is a toggle beside the
top-down map on `village.html` (button under the HUD, or `?iso` / `?iso=0`).
Every piece is a generated placeholder block until its art and manifest entry
exist. The code lives in `src/village/iso/` and `src/village/ui/IsoMapView.tsx`.

## 1. Camera

| Setting | Value |
| --- | --- |
| Heading (yaw) | 45°, fixed. One map orientation; the map never rotates. |
| Pitch | atan(1/√2) = 35.26° (true isometric) |
| Ground tile on screen | a diamond, width : height = √3 : 1 ≈ 1.732 : 1 (not 2 : 1) |
| Light for painted art | proposed: from the upper left of the screen (the renderer adds time-of-day grading on top) |

The camera stands to the south-east of the village and looks north-west.
On screen:

```
                north
                  ↗          grid -y (north) → screen up-right
   west ↖                    grid -x (west)  → screen up-left
          ◇  one tile
   south ↙                   grid +y (south) → screen down-left
                  ↘ east     grid +x (east)  → screen down-right
```

Each tile's south-east corner is nearest the viewer, so the faces you paint on
a building are its **top**, its **south face** (lower left) and its **east
face** (lower right).

## 2. Reference scale (authoring pixels)

| Quantity | Pixels at scale 1 |
| --- | --- |
| Tile diamond width | **256** |
| Tile diamond height | **147.8** (256 / √3) |
| One tile edge of height (1 world unit up) | **147.8** (the same as the diamond height; a cube is a true cube) |
| One terrain level (height step) | 0.5 world units = **73.9** |

World units: one tile edge = 1. Heights are always set in world units and the
renderer projects them; no art assumes a fixed number of pixels per level.
`TIER_STEP = 0.5` in `src/village/iso/projection.ts` is the one place to
change it.

A sheet can declare its own scale with `tileWidthPx`: how many of its pixels
span one tile diamond's width. The renderer scales each sprite by
`256 / tileWidthPx` before zooming.

* Buildings, props and features default to `tileWidthPx: 256`, so a 1 × 1
  building painted edge to edge fills a 256 px canvas.
* Kin default to `tileWidthPx: 512`, so a 256 × 256 Hero cell stands about half
  a plot wide (a plot holds a party of up to four). Change it per sheet if Hero
  should read larger or smaller.

## 3. Canvases and the ground anchor

Every sprite is a transparent PNG made of **256 × 256 cells** (other cell sizes
are allowed if the manifest says so).

The **pivot** is the sheet pixel that sits on the ground point. One rule covers
everything: **the pivot is the centre of the piece's footprint, on the ground.**

| Piece | Pivot in its cell | What it means |
| --- | --- | --- |
| Kin (Hero and others) | **(128, 239)** | bottom centre: the point between the feet on the ground |
| 1 × 1 building or prop | **(128, 165)** | centre of the footprint diamond; the diamond's front (south-east) tip then lands at y = 239, the same ground line as kin |
| Larger footprints | the footprint diamond's centre | declare it in the manifest |

Nothing in the art declares a footprint. Footprints are placement data in
`src/village/iso/footprints.ts` as **width × depth in tiles** (width along grid
x, east; depth along grid y, south). Every building and feature is 1 × 1 today.
Changing a footprint never needs new art metadata, and swapping a placeholder
for a painting never moves a footprint.

Keep the art inside its footprint's diamond at ground level. Anything that
overhangs the diamond (a roof, a branch) is fine, but it should not reach the
ground of a neighbouring tile, because the renderer sorts by tile.

## 4. Kin headings

Headings are screen-relative. **S faces the viewer** (screen down), **N faces
away** (screen up).

| Heading | Source |
| --- | --- |
| S, SE, E, NE, N | painted |
| SW, W, NW | mirrored from SE, E, NE |

A grid move maps to a heading through the camera: a step east is SE, a step
south is SW, a step north is NE, a step west is NW. The first slice shows every
kin facing S (wanderers at the gate face SW). Movement animation comes later.

Overhead frames (the top-down map) rotate around their centre and are not used
by the isometric view.

## 5. Manifest

The renderer reads these files if they exist:

| Set | Path |
| --- | --- |
| Village buildings, props, features, sapling, den, gate | `public/assets/runtime/village/iso/v1/manifest.json` (proposed; sources in `public/assets/sources/village/iso/v1/`) |
| Hero | `public/assets/runtime/kin/hero/sprites/world/painterly-zootopia-v1/manifest.json` |

A missing manifest, or a missing key inside one, falls back to the placeholder
block for that piece.

```json
{
  "set": "hero-painterly-zootopia-v1",
  "version": 1,
  "tileWidthPx": 512,
  "sprites": {
    "kin.hero": {
      "src": "hero-idle-sheet-v1.png",
      "cell": [256, 256],
      "pivot": [128, 239],
      "headings": { "S": 0, "SE": 1, "E": 2, "NE": 3, "N": 4 },
      "frames": 6,
      "fps": 8
    }
  }
}
```

Sheet layout: one **column per painted heading** (the column index is the
number in `headings`) and one **row per animation frame**, top to bottom. A
single still is one row (`frames` 1, no `fps`).

```json
{
  "set": "village-iso-v1",
  "version": 1,
  "tileWidthPx": 256,
  "sprites": {
    "building.leanto": { "src": "building-leanto-iso-v1.png", "pivot": [128, 165] },
    "feature.forest": { "src": "feature-forest-iso-v1.png", "pivot": [128, 165] },
    "sapling": { "src": "curious-sapling-iso-v1.png", "pivot": [128, 165] }
  }
}
```

Sprite keys:

| Key | Piece |
| --- | --- |
| `building.<id>` | `leanto`, `burrow`, `campfire`, `bench`, `stall`, `rack`, `woodshed`, `lantern`, `well` |
| `feature.<id>` | `forest`, `berries` |
| `sapling` | the Curious Sapling |
| `den.simple`, `den.improved`, `den.worksite` | the den states |
| `gate` | the gate at the left edge |
| `kin.<id>` | `hero`, `mochi`, `banks`, `demi`, and wanderers such as `cir` |

## 6. Terrain height

Terrain comes from the one height field in `src/village/rules/terrain.ts`.

* Below one terrain level the land stays on the ground plane and carries its
  height as painted colour and hillshade only (the meadow, gentle slopes and
  the lake).
* From one level up (the berm crest north of the clearing, the hills, the fell
  to the east and the northern range) a tile is raised as a column in whole
  levels, `floor(height) × 0.5` world units. Those are the places where height
  can block sight or, later, movement.
* The starting patch is flat.
* Land the player hasn't seen lies flat as blank paper, so the fog of war never
  shows a mountain's outline.

## 7. Draw order

1. Every ground-plane tile, all at once.
2. Back to front by diagonal (`x + y` ascending): raised columns (south and
   east cliff faces, then the top), then the pieces standing on that diagonal.
   A piece with a footprint bigger than 1 × 1 is drawn with its front
   (south-east) tile.

Tapping uses the same geometry in reverse: sprite boxes from front to back,
then the highest terrain face under the pointer.

## 8. Open questions for Eric

* Hero's `tileWidthPx` (how big Hero stands against a plot). The default 512
  makes the 256 cell half a plot wide.
* Whether painted building light should stay upper-left or follow the
  village's sun. The renderer grades for time of day either way.
* Whether the berm should block movement once terrain gains rules. It is
  raised now because it hides what's behind it.
