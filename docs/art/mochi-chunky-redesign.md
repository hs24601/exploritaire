# Mochi chunky redesign — 2026-10-11

Built-in ImageGen style transfer, requested globally to match Hero's chunky, cute, expressive pixel art. Runtime uses v2 directional sheets and v4 card art; v1 sheets remain historical sources. All eight sides have independent coat markings at low and elevated camera angles, plus a nose-up overhead view. The shared quadruped rig retains explicit anatomical regions and joints.

## Prompt set

Low: use the old low sheet as identity/direction target and Hero's low sheet as style reference. Redesign eight complete standing cat views in front, left front-quarter, left profile, left rear-quarter, rear, right rear-quarter, right profile, right front-quarter order. Oversized round head, large bright amber-green eyes, gentle curious brows, tiny smiling muzzle, short thick legs, rounded dark paws, compact fluffy body and rounded plume tail. Simplify realistic hair into broad charcoal/copper/tawny clusters with bold pixel outlines. Keep pointed tufted feline ears and asymmetric tortoiseshell markings; no white socks or dog anatomy. Separate full silhouettes on transparent alpha, no text, scenery, shadows or glow.

High: use the new low sheet for identity/style, old high sheet for camera directions and Hero for chunky cartoon style. Nine full standing cats in three rows: front/left front-quarter/left profile; left rear-quarter/rear/right rear-quarter; right profile/right front-quarter/true overhead nose-up. First eight use an elevated camera near 40 degrees. Match new low proportions and expressive eyes, simplify hair into broad pixel clusters; clear transparent gutters, no overlaps, text, shadows, glow or scenery.

Card: see `public/assets/art/holocards/actors/mochi-card-v4.prompt.txt`. Shared inspection/foundation card illustration matches the new sprite proportions.

Generated sources: `exec-5d5a713a-27c0-46d9-af53-968ac5a92297.png` (low), `exec-ded9ffcc-d361-49b0-90f6-6f5052d6b159.png` (high), `exec-a10d6ff2-08a9-42ff-b9cf-0120b6ebfab7.png` (card).

`tools/prepare-mochi-sprites.cjs` measures silhouette bounds offline and writes the shared layout JSON. Runtime never segments image pixels. The new sheets need no corner crop guards.
