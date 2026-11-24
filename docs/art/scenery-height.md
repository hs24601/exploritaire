# World scenery height scale

`src/proto/sceneryHeight.ts` defines uncapped, non-negative world height units. Height is independent of ground footprint, camera zoom and tile ground elevation. One unit = `46 × (3/7) / 5 = 3.942857…` world pixels. This calibrates the current painted Berry Patch crown envelope (about 19.714 world pixels) to 5 and den spill rocks to 1.

Existing presentation was sized by world-pixel boxes, alpha-trimmed sprite aspect ratios, footprint fitting and Pixel volume recipe height multipliers. There was no shared scale. Keep existing shapes; this calibration measures them rather than resizing them. Approximate current Paint values:

| Scenery | Height units |
| --- | ---: |
| Ground | 0 |
| Den spill rocks | 1 |
| Berry Patch crown envelope | 5 |
| Painted den | 6.3 |
| Mountain peaks in current opening | 11.6 |
| Full woods tree cluster, fitted to one 48px cell | 8 |
| Side-edge pine | Proportional to its smaller footprint |
| Front-edge foliage | Proportional to its smaller footprint |

Individual crowns, terrain connectors and fitted edge props vary. These are visual world heights, not real-world metres. The berry reference is the tallest crown envelope of the existing multi-bush sprite; its ground-depth arrangement makes individual front bushes shorter. Camera perspective changes screen height but not units. Pixel volume heights follow existing recipes and need their own measurements; the unit conversion remains the same.

New scenery can author a height beyond these values (e.g. a 25-unit spire is about 98.57 world pixels tall), while retaining an independently contained footprint. `heightToWorld` and `heightFromWorld` perform conversion without a mountain-height clamp. Future spire artwork/renderer integration remains separate; no spire is added here.

Spill rules accept optional `relief` (minimum and default 1 in immersion). Den stone spills use 1. Immersion displays a smoothly sampled, ground-anchored cutout with its width unchanged and height from the shared units, sharing surrounding light and camera-facing convention with existing painted scenery. This is painted cutout relief, not a reconstructed stone mesh. OTT retains the original overhead print. Berry/earth spills also use at least height 1. Existing deterministic positions, discovery, pointer transparency and Pixel switching remain.

2026-10-13 height swap: immersive painted trees now use 8 and mountain peaks 11.6. Shared sprite layout scales the vertical art while retaining width and ground foot; shadow masks and atmosphere profiles use the same calculation. Edge pines are sized relative to their own footprints; the older edge-height estimates above are superseded. Mountain connector heights scale by 11.6/8. OTT and card images remain unchanged.

Woods proportion correction (2026-10-13): painted woods/pines now scale uniformly to height 8, reducing their visible widths alongside heights. Ground anchors and tile ownership stay fixed; shadows and atmosphere masks share the preserved aspect ratio.
