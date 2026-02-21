# Editor Persistence Architecture

## Core Principle

All editor tools (POI, Ability, Orim, Synergy, Aspect) are **development tools** for authoring the game world. When you click "Save" in any editor:

1. **Changes must be written to disk immediately**
2. **Changes persist across page refreshes**
3. **Changes are permanent until explicitly deleted or overwritten**

## Current Implementation

### Working Editors ✓
- **Orims**: Saves to `src/data/orims.json` + generates `src/engine/orims.ts`
- **Abilities**: Saves to `src/data/abilities.json`
- **Aspects**: Saves to `src/data/aspects.json`
- **Synergies**: Saves to `src/data/synergies.json`
- **Aspect Profiles**: Saves to `src/data/aspectProfiles.json`

### Broken Editor ✗
- **POI**: Currently only updates in-memory with console.log output (WRONG!)

## Required Fix

POI editor must follow the same pattern:
1. Create `src/data/pois.json` - stores all POI definitions
2. Create/generate `src/data/pois.ts` - TypeScript export (like orims.ts)
3. Update `worldMap.ts` to import POIs from pois.ts
4. Add vite middleware `/__pois/save` to write to disk
5. Update App.tsx handleSavePoi to use the endpoint

## Pattern to Follow

See `/__orims/save` in vite.config.ts for reference - it writes both JSON and generates TS file.
