import { expect, it } from 'vitest';
import { newGame } from './game';
import { neighboursOf, SAPLING, tileAt, tileIndex } from './map';
import { tileHeight, WATER_BELOW } from './terrain';
import { villageRoute } from './travel';

it('routes around buildings and rank fog using shared tile edges', () => {
  const game = newGame(1);
  const from = tileIndex(4, 4), to = tileIndex(9, 4);
  const building = tileIndex(5, 4);
  game.village.plots[building] = 'leanto';
  const route = villageRoute(game, from, to)!;
  expect(route[0]).toBe(from);
  expect(route[route.length - 1]).toBe(to);
  expect(route).not.toContain(building);
  expect(route).not.toContain(tileIndex(8, 4));
  expect(route).toHaveLength(10);
  for (let i = 1; i < route.length; i++) expect(neighboursOf(route[i - 1])).toContain(route[i]);
});

it('allows a site as an interaction destination and rejects water', () => {
  const game = newGame(1);
  const from = tileIndex(4, 8), sapling = tileIndex(SAPLING.x, SAPLING.y);
  expect(villageRoute(game, from, sapling)).toBeNull();
  expect(villageRoute(game, from, sapling, true)).toHaveLength(6);
  const lake = tileIndex(15, 12);
  expect(tileHeight(15, 12)).toBeLessThan(WATER_BELOW);
  expect(villageRoute(game, from, lake)).toBeNull();
  const route = villageRoute(game, from, tileIndex(19, 13))!;
  for (const index of route) {
    const { x, y } = tileAt(index);
    expect(tileHeight(x, y)).toBeGreaterThanOrEqual(WATER_BELOW);
  }
});
