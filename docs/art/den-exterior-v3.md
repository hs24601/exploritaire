# Den exterior mountain match

Requested art pass, 2026-10-13: match the outside of the three closed den sides to adjacent impassable mountains; preserve the mouth and Hero.

ImageGen edited `hero-den-overhead-v2.png` using `mountain-overhead-v1.png` as the material reference. Prompt: repaint only left, right and closed rear exterior stone in cool blue-slate/indigo, pale cream ridges and sparse broken ridge accents; retain the original footprint, roof contour, hollow and bottom entrance, with transparent exterior and no animals or text. Original generated source is retained in `public/assets/biomes/watercolor-v1/sources/hero-den-exterior-v3-generated.png`.

`tools/prepare-den-exterior-v3.cjs` restores the original alpha, inner hollow and mouth end pixel-for-pixel, with a narrow blend outside protected areas. It also replaces the woodland fringe along the three closed ground edges with the existing mountain floor, preserving the entrance edge. Outputs: `hero-den-overhead-v3.png` and `hero-den-ground-v2.png`. Shared scenery selection supplies the overhead and foreground roof together. Hero assets, immersive cave geometry/front material and Pixel sources are unchanged; immersion receives the matching ground fringe.

Validation: `npm run typecheck`; isolated Playwright at 1280×720 and 1912×914, 3× screenshots of OTT and immersion, overhead/roof source assertions and no page errors. Evidence: `artifacts/den-exterior-v3/`.
