# Elemental value backsplash trial

Scenario 1002 replaces its perimeter adornments with authored dark rounded value plaques for all six elements. Each has a compact version for covered-card header values and a large version for exposed centered ranks. The rank remains live cream text in a separate layer; images contain no numerals. Unadorned cards retain their existing value backings. Existing affinity labels, input and rank placement are preserved, including the wide 10. Prior corner assets and their components remain available as alternate artwork.

Created with built-in ImageGen. Runtime and exact source copies: public/assets/{runtime,sources}/ui/value-backdrops/{nature,fire,water,air,earth,chaos}-{compact,large}-v1.png. Exact prompts are in public/assets/sources/ui/value-backdrops/manifest.json. The user-provided plaque containing 7 was the image reference.

Implementation: ElementRankBackdrop.tsx/.css, composed inside ProtoCard's compact and centered rank wrappers. Number text and input remain independent of the painted image.

Validation: npm run typecheck passed. One focused headless Chromium run decoded all 12 assets, verified 18 compact and six large plaques, live rank bounds, decorative image behavior, absence of perimeter images and no page errors. Desktop/tableau and compact screenshots were visually reviewed in artifacts/element-value-backdrops/. Gameplay interactions were not separately exercised in this art pass.
