import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './game';
import { FOG, MAP_COLS, MAP_ROWS, SAPLING, tileIndex } from './map';
import { DAWN_AMBIENT, ambientAt, knownTiles, revealedBy, tileLight, villageLights } from './light';
import { MOUNTAIN_FROM, contours, terrainKind, tileHeight } from './terrain';

describe('village light field', () => {
  it('opens the day in readable low light, peaks at noon and goes dark at night', () => {
    const dawn = ambientAt(0, 840, false), noon = ambientAt(420, 840, false), night = ambientAt(900, 840, true);
    expect(dawn.ambient).toBeCloseTo(DAWN_AMBIENT, 5);
    expect(dawn.phase).toBe('Dawn');
    expect(noon.ambient).toBeGreaterThan(0.9);
    expect(noon.twilight).toBe(0);
    expect(night.night).toBe(true);
    expect(night.ambient).toBeLessThan(dawn.ambient);
    // The sun crosses east to west.
    expect(dawn.sunDir.x).toBeGreaterThan(0.9);
    expect(ambientAt(830, 840, false).sunDir.x).toBeLessThan(-0.9);
  });

  it('lights the sapling square brighter than open land at night, in 0-100%', () => {
    const game: GameState = { ...newGame(7), minutes: 900 };
    const at = tileLight(game, SAPLING.x, SAPLING.y);
    const far = tileLight(game, 0, 0);
    expect(at.percent).toBeGreaterThan(far.percent);
    expect(at.percent).toBeLessThanOrEqual(100);
    expect(['lit', 'bright']).toContain(at.level);
    expect(far.level).toBe('dark');
  });

  it('knows the clearing from the start but not the land under the rank fog', () => {
    const game = newGame(7);
    const known = knownTiles([], game);
    expect(known.has(tileIndex(0, 0))).toBe(true);
    expect(known.has(tileIndex(FOG.x, FOG.y))).toBe(false);
    expect(known.has(tileIndex(MAP_COLS + 5, MAP_ROWS + 5))).toBe(false);
  });

  it("reveals land around Hero's party, never through the rank fog", () => {
    const game = newGame(7);
    const hero = game.parties.find(p => p.members.includes('hero'))!;
    const revealed = revealedBy(villageLights(game), game.rankReached);
    expect(revealed).toContain(hero.tile);
    expect(revealed.every(i => { const x = i % MAP_COLS, y = Math.floor(i / MAP_COLS); return i >= MAP_COLS * MAP_ROWS || !(x >= FOG.x && y >= FOG.y && x < FOG.x + FOG.w && y < FOG.y + FOG.h); })).toBe(true);
    // Memory persists after the light moves on.
    const moved = { ...game, parties: [{ tile: tileIndex(SAPLING.x, SAPLING.y), members: hero.members }] };
    expect(knownTiles(knownTiles([], game), moved).has(hero.tile)).toBe(true);
  });
});

describe('village terrain', () => {
  it('keeps the starting clearing flat so no current rule moves', () => {
    for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLS; x++) expect(Math.abs(tileHeight(x, y))).toBeLessThan(0.75);
  });

  it('raises mountains in the far north and holds water in the south-east basin', () => {
    expect(tileHeight(SAPLING.x, SAPLING.y - 18)).toBeGreaterThan(MOUNTAIN_FROM - 2);
    expect(terrainKind(SAPLING.x + 10, SAPLING.y + 9)).toBe('water');
  });

  it('traces closed-looking contours around the lone fell', () => {
    const lines = contours([3], 0.5, { x: 15, y: -8, w: 14, h: 14 }).get(3)!;
    expect(lines.length).toBeGreaterThan(10);
  });
});
