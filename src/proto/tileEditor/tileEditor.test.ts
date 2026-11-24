import { describe, expect, it } from 'vitest';
import { createInitialState } from '../rules/setup';
import { authorTile, newAuthoredTile, validateTileDocument, type TileDocument } from './schema';
import { SAVED_TILE_DOCUMENT, applyTileDocument, materializeTiles } from './runtime';
import { traversalProfile } from '../travelJourney';
import { arriveActorAtBiome } from '../biomeArrival';

const draft = (): TileDocument => ({ ...structuredClone(SAVED_TILE_DOCUMENT), tiles: createInitialState(false).biomeTiles.map(authorTile) });

describe('tile authoring boundaries', () => {
  it('round-trips sparse patch authoring while keeping harvest depletion out of saved data', () => {
    const state=createInitialState(), sparse=state.biomeTiles.find(tile=>tile.berryPatchVariant==='sparse')!;
    expect(sparse.tableau.flat()).toHaveLength(0);
    const authored=authorTile({...sparse,berryHarvested:true});
    expect(authored.berryPatchVariant).toBe('sparse');expect(authored).not.toHaveProperty('berryHarvested');
    expect(materializeTiles(SAVED_TILE_DOCUMENT,[{...sparse,berryHarvested:true}],true).find(tile=>tile.id===sparse.id)?.berryHarvested).toBe(true);
    expect(materializeTiles(SAVED_TILE_DOCUMENT,[{...sparse,berryHarvested:true}],false).find(tile=>tile.id===sparse.id)?.berryHarvested).toBeUndefined();
    const invalid=structuredClone(SAVED_TILE_DOCUMENT);invalid.tiles!.find(tile=>tile.id===sparse.id)!.kind='woods';
    expect(()=>validateTileDocument(invalid)).toThrow(/Sparse/);
  });
  it('round-trips population density separately from deals and validates its range', () => {
    const document=draft(), state=createInitialState();
    const tile=document.tiles!.find(t=>t.kind==='woods')!;
    tile.populationDensity=9;
    const result=materializeTiles(document,state.biomeTiles);
    const live=result.find(t=>t.id===tile.id)!;
    expect(authorTile(live).populationDensity).toBe(9);
    expect(live.resourceDensity).toBe(tile.resourceDensity);
    expect(live.tableau).toBe(state.biomeTiles.find(t=>t.id===tile.id)!.tableau);
    tile.populationDensity=11;
    expect(()=>validateTileDocument(document)).toThrow(/Population density/);
  });
  it('validates the current authored layout and excludes all session work', () => {
    const document = draft(); expect(() => validateTileDocument(document)).not.toThrow();
    const tile = createInitialState().biomeTiles.find(tile => tile.id === 'curious-sapling')!;
    const authored = authorTile({ ...tile, traversalProgress: .75, clearedDay: 2, tableau: [[{ id: 'collected-card', rank: 3 }]] });
    expect(authored).not.toHaveProperty('tableau'); expect(authored).not.toHaveProperty('stock');
    expect(authored).not.toHaveProperty('seed'); expect(authored).not.toHaveProperty('traversalProgress'); expect(authored).not.toHaveProperty('clearedDay');
  });
  it('rejects duplicate IDs, overlapping cells, out-of-bounds footprints and hidden session fields', () => {
    const document = draft(), tile = document.tiles![0];
    expect(() => validateTileDocument({ ...document, tiles: [...document.tiles!, tile] })).toThrow();
    expect(() => validateTileDocument({ ...document, tiles: [...document.tiles!, { ...tile, id: 'duplicate' }] })).toThrow(/overlap/);
    expect(() => validateTileDocument({ ...document, tiles: [...document.tiles!, newAuthoredTile('woods', 7, 7, 'edge'), { ...newAuthoredTile('woods', -7, -7, 'edge-two'), gridSize: { columns: 2, rows: 1 } }] })).toThrow();
    expect(() => validateTileDocument({ ...document, journey: {} })).toThrow(/Unknown/);
    expect(() => validateTileDocument({ ...document, tiles: document.tiles!.map(t => ({ ...t, tableau: [] })) })).toThrow(/Unknown/);
  });
  it('protects the den location and zero-cost home traversal', () => {
    const document = draft();
    expect(() => validateTileDocument({ ...document, tiles: document.tiles!.filter(t => t.id !== 'hero-den') })).toThrow(/Den/);
    expect(() => validateTileDocument({ ...document, defaults: { ...document.defaults, 'hero-den': { traversalDifficulty: 2, travelCards: 12 } } })).toThrow();
  });
  it('resolves terrain defaults separately from per-cell overrides and preserves active deals', () => {
    const document = draft(), state = createInitialState();
    document.defaults.dirt.traversalDifficulty = 5;
    // Exercise known-terrain inheritance independently of saved fog and overrides.
    const inherited = document.tiles!.find(t => t.id === 'dirt--2-1')!;
    delete inherited.traversalDifficulty;
    inherited.initiallyRevealed = true;
    const overridden = document.tiles!.find(t => t.id === 'dirt-0-1')!;
    overridden.traversalDifficulty = 2; overridden.initiallyRevealed = true;
    const result = applyTileDocument(state, document);
    expect(traversalProfile(result.biomeTiles.find(t => t.id === 'dirt-0-1')).difficulty).toBe(2);
    expect(traversalProfile(result.biomeTiles.find(t => t.id === 'dirt--2-1')).difficulty).toBe(5);
    expect(result.biomeTiles.find(t => t.id === 'day-one-berries')!.tableau).toBe(state.biomeTiles.find(t => t.id === 'day-one-berries')!.tableau);
    expect(result.haul).toBe(state.haul);
  });
  it('creates playable woods, paths and independent berry deals; restores authored fog on new sessions', () => {
    const document = draft();
    document.tiles!.push(newAuthoredTile('woods', 4, 0, 'new-woods'), newAuthoredTile('path', 5, 0, 'new-path'), newAuthoredTile('berry-patch', 6, 0, 'new-berry'));
    const tiles = materializeTiles(document, [], false);
    expect(tiles.find(t => t.id === 'new-woods')!.tableau.flat().some(card => card.resource === 'wood')).toBe(true);
    expect(tiles.find(t => t.id === 'new-path')!.tableau.flat()).toHaveLength(13);
    const berries = tiles.find(t => t.id === 'new-berry')!.tableau.flat();
    expect(berries).toHaveLength(28); expect(berries.filter(c => c.resource === 'mana')).toHaveLength(6);
    expect(berries.every(c => c.id.startsWith('new-berry-'))).toBe(true);
    expect(tiles.find(t => t.id === 'new-woods')!.flags).toContain('unexplored');
    const state = applyTileDocument(createInitialState(), document);
    expect(arriveActorAtBiome(state, 'hero', 'new-woods', { x: 192, y: 0 }).selectedBiomeId).toBe('new-woods');
  });
  it('rejects applying during travel/tableau play and blocking an actor cell', () => {
    const state = createInitialState(), document = draft();
    expect(() => applyTileDocument({ ...state, selectedBiomeId: 'day-one-berries' }, document)).toThrow(/leave/);
    document.tiles!.push(newAuthoredTile('impassable-mountain', 4, 0, 'blocked'));
    expect(() => applyTileDocument({ ...state, worldActors: [{ ...state.worldActors[0], position: { x: 192, y: 0 } }] }, document)).toThrow(/Move Hero/);
  });
});
