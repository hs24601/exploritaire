# POI System Refactor - Persistent Disk Storage

## Summary

The POI (Point of Interest) editor now **permanently saves changes to disk**, matching the behavior of all other editors (Orims, Abilities, Aspects, Synergies).

## What Changed

### 1. Removed Override System
- **Deleted**: `src/data/poiOverrides.json`
- **Removed**: POI override middleware from `vite.config.ts`
  - `/__poi/overrides` (GET)
  - `/__poi/save` (POST)
- **Removed**: Override loading code from `App.tsx`

### 2. Created New POI Storage System
- **Created**: `src/data/pois.json` - JSON source of truth for all POI definitions
- **Created**: `src/data/pois.ts` - Generated TypeScript export (auto-updated on save)
- **Updated**: `worldMap.ts` now imports `POI_DEFINITIONS` from `pois.ts` instead of defining inline

### 3. Added POI Save Middleware
New vite middleware endpoints:
- `/__pois/overrides` (GET) - Loads `pois.json`
- `/__pois/save` (POST) - Saves to both `pois.json` and generates `pois.ts`

### 4. Updated POI Editor
- `App.tsx` `handleSavePoi` now:
  1. Loads all POIs from disk
  2. Finds POI by ID from coordinates
  3. Updates that POI in the array
  4. Saves entire array back to disk
  5. Generates updated `pois.ts` automatically
  6. Updates in-memory `mainWorldMap` for immediate preview

## Type Mappings

The POI editor UI uses different type values than the actual POI data:

**Editor → POI Type:**
- `'combat'` → `'biome'`
- `'puzzle'` → `'empty'`

This mapping is applied in both `loadPoi` (load from data) and `handleSavePoi` (save to data).

## Files Modified

1. `src/data/worldMap.ts` - Now imports POIs from `pois.ts`
2. `src/data/pois.json` - NEW - JSON source
3. `src/data/pois.ts` - NEW - Generated TypeScript
4. `vite.config.ts` - Added POI save/load middleware
5. `App.tsx` - Updated POI save logic to use new endpoints
6. `src/components/CombatGolf.tsx` - Removed debug logging

## Verification

1. Open POI editor
2. Load coordinates `0,2`
3. Make a change (e.g., add/remove reward)
4. Click "Save"
5. Refresh page
6. Load `0,2` again - changes should persist

## Data Preserved on Save

The following fields are preserved when editing:
- `id` - POI identifier
- `description` - POI description text
- `biomeId` - Biome definition reference
- `tableauPresetId` - Tableau preset reference
- `sparkle.intensity` - Light intensity value

These fields cannot be edited in the current UI but are preserved from the existing data.
