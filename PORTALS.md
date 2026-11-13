# Portals world snapshot

This branch captures the Portals game and its required shared code and registered asset bank from the ce4e969920cc75b359a49a4d84a45ce975119345 development checkout. The original checkout and its unrelated staged/untracked work are preserved.

## Run

Use Node.js 22 or newer. Run `npm ci`, then `npm run dev`. Open `http://localhost:5178/portals.html`. Add `?combat`, `?tree` or `?valley` to select an entry world. The address is preserved. The ordinary default is Combat Woods.

`npm run build` type-checks the Portals import graph and builds the connected Portals, book, castle, musical-combat and sticker entry pages. `npm run preview` serves the result. Editor disk saves require the development server. The existing trusted-address/revision validation remains in the shared Vite configuration.

## Controls and validation

Left stick walks/runs; hold A to sprint, B jumps, X dives, LT crouches/ground-pounds, right stick/D-pad orbits, RB centers, Y interacts, Start pauses. Hold LB and use left-stick Y for slow zoom. Controller takeover adopts the close centered rear camera; paused LB/RB still switch settings tabs. Flurry's legacy collection data migrates automatically.

Run `npm test` for the selected game regressions. With the dev server running, run `npm run test:browser` for headless world-entry, grove collision, sprint/jump, camera/zoom and portal round-trip checks. Set `PORTALS_TEST_ORIGIN` when using a different localhost port.

## Captured components

The dependency manifest is `docs/portals-snapshot-manifest.json`. It records source, styles, authored world/page data, loaders, book/world code, combat rules/UI, controller input, Flurry/stickers, audio/rendering helpers, tests, build tooling, registered runtime/source art and vendor license/provenance records. Recursive editor art catalogs require the complete public asset bank. Original images and assets are bundled; no sibling art checkout is required.

Generated `output/`, `artifacts/`, logs, caches, dependencies, builds and environment files are excluded. Existing tracked files from the base commit remain part of its history; unrelated current development changes were not copied. Build/test packaging is adapted, and two required images formerly imported from ignored artifacts are bundled under src/assets/portal-dependencies with updated import paths. Gameplay logic and artwork bytes are unchanged. The manifest records both original image paths. Browser-only authoring drafts are not Git files: use World Studio's Save to disk to preserve future edits.
