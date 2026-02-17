# World Map POI Tutorial (Oasis A)

## Overview
- Added a POI-backed tutorial route in the world map data.
- Spawn/reference point is `(0, 0)`.
- First tutorial POI is `Oasis A` at `(0, -2)` (two nodes north).

## POI -> Tableau Link
- POIs can now declare `tableauPresetId` in `PointOfInterest`.
- `Oasis A` uses `tableauPresetId: oasis_a_tutorial`.
- Exploration tableau generation checks the active node coordinate and applies the POI preset when present.

## Oasis A Tableau Design
- Deterministic 8-column, 3-row layout.
- Front row (visible tops): `A,2,3,4,5,6,7,8` left-to-right.
- Middle row: same progression, slightly out of order.
- Back row: wrap-focused sequence to reinforce golf transitions (increment, decrement, ace/king wrap context).

## Exploration Foundation + Supplies Rules
- In RPG `random_wilds`, foundations now start as a single wild foundation.
- Using a supply in exploration:
  - consumes 1 supply
  - grants +20 action points
  - adds a wild card to the player RPG hand

## Files
- `src/engine/worldMapTypes.ts`
- `src/data/worldMap.ts`
- `src/data/poiTableaus.ts`
- `src/components/CombatGolf.tsx`
- `src/engine/game.ts`
