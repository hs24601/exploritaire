import { describe, expect, it } from 'vitest';
import { dayObjective } from './dayObjectives';
import { createDayScenario } from './dayScenarios';
import { SAVED_TILE_DOCUMENT } from './tileEditor/runtime';
import type { TileDocument } from './tileEditor/schema';
import { dayOnePlan } from './dayScenarios';
import { beginJourney } from './travelJourney';

describe('daily objective waypoints', () => {
  it('completes an immutable first card only when travel actually starts', () => {
    const day = createDayScenario('day01');
    expect(dayObjective(day)?.quest?.steps[0]).toMatchObject({ text: 'Leave the den.', complete: false });
    const plan = dayOnePlan(day);
    const traveling = { ...day, journey: beginJourney(plan, 2) };
    expect(dayObjective(traveling)?.quest?.steps[0]).toMatchObject({ text: 'Leave the den.', complete: true });
    expect(dayObjective(traveling)?.quest?.steps[1]).toMatchObject({ id: 'navigate-den', complete: false });
    expect(dayObjective(traveling)?.label).toBe('Check the nearby bush');
  });
  it('follows Day 01 from the patch back to the den, including supper and rest', () => {
    const day = createDayScenario('day01');
    expect(dayObjective(day)).toMatchObject({ biomeId: day.dayScenarioTiles?.sparsePatchId, label: 'Check the nearby bush' });
    const afterSparse = { ...day, biomeTiles: day.biomeTiles.map(tile => tile.berryPatchVariant === 'sparse' ? { ...tile, berryHarvested: true } : tile) };
    expect(dayObjective(afterSparse)).toMatchObject({ biomeId: day.dayScenarioTiles?.patchId, label: 'Gather manaberries' });
    expect(dayObjective({ ...afterSparse, haul: { ...day.haul, mana: 2 } })?.biomeId).toBe(day.dayScenarioTiles?.patchId);
    const returning = { ...day, haul: { ...day.haul, mana: 3 } };
    expect(dayObjective(returning)).toMatchObject({ biomeId: 'hero-den', label: 'Home before dark' });
    const supper = { ...day, ordinaryDay: { ...day.ordinaryDay!, supper: true } };
    expect(dayObjective(supper)).toMatchObject({ biomeId: 'hero-den', label: 'Rest in the den' });
    expect(dayObjective({ ...supper, ordinaryDay: { ...supper.ordinaryDay, complete: true } })?.label).toBe('Safe until morning');
  });

  it('points Day 02 toward its bound woods after the first mana and hides during the rescue', () => {
    const day = createDayScenario('day02');
    expect(dayObjective(day)?.biomeId).toBe(day.dayScenarioTiles?.patchId);
    expect(day.haul.mana).toBe(1);
    const woods = { ...day, haul: { ...day.haul, mana: 2 } };
    expect(dayObjective(woods)).toMatchObject({ biomeId: day.dayScenarioTiles?.woodsId, label: 'Search the darker woods' });
    expect(dayObjective({ ...woods, dayTwoAmbush: true })).toBeNull();
  });

  it('marks the Day 03 den staging and leaves the sandbox without a scripted objective', () => {
    expect(dayObjective(createDayScenario('day03'))).toMatchObject({ biomeId: 'hero-den', label: 'Home with Banks' });
    expect(dayObjective(createDayScenario('sandbox'))).toBeNull();
  });

  it('uses applied landmark coordinates without mutating tiles or discovering their contents', () => {
    const document = structuredClone(SAVED_TILE_DOCUMENT) as TileDocument;
    const patch = document.tiles!.find(tile => tile.berryPatchVariant === 'sparse')!;
    patch.id = 'my-moved-patch'; patch.column = -4; patch.row = -3;
    const day = createDayScenario('day01', document), before = JSON.stringify(day);
    expect(dayObjective(day)).toMatchObject({ biomeId: patch.id, position: { x: -192, y: -144 }, reference: 'table:-4,-3' });
    expect(JSON.stringify(day)).toBe(before);
    expect(dayObjective({ ...day, biomeTiles: [] })).toBeNull();
  });
});
