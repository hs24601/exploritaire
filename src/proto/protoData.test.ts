import { describe, expect, it } from 'vitest';
import {
  PROTO_ACTORS,
  PROTO_ENEMIES,
  PROTO_ENEMY_SLOT_IDS,
  DEFAULT_BIOME,
  getHolyNovaPower,
} from './protoData';

describe('classic plus data contracts', () => {
  it('uses unique actor and enemy IDs', () => {
    expect(new Set(PROTO_ACTORS.map((actor) => actor.id)).size).toBe(PROTO_ACTORS.length);
    expect(new Set(PROTO_ENEMIES.map((enemy) => enemy.id)).size).toBe(PROTO_ENEMIES.length);
  });

  it('keeps attack intents and fixed board slots connected to declared data', () => {
    const actorIds = new Set(PROTO_ACTORS.map((actor) => actor.id));
    const enemyIds = new Set(PROTO_ENEMIES.map((enemy) => enemy.id));

    PROTO_ENEMIES
      .filter((enemy) => enemy.intent.tone === 'attack')
      .forEach((enemy) => expect(actorIds.has(enemy.intent.targetId ?? '')).toBe(true));
    PROTO_ENEMY_SLOT_IDS.forEach((slotId) => expect(enemyIds.has(slotId)).toBe(true));
  });

  it('assigns Jarn the cleric-owned Hallowed Path mobility', () => {
    const jarn = PROTO_ACTORS.find((actor) => actor.id === 'jarnathan');

    expect(jarn?.label).toBe('Jarn');
    expect(jarn?.mobility).toEqual({ kind: 'hallowed_path', label: 'Hallowed Path' });
  });

  it('scales Holy Nova from 3 power at 5 CP, then one power per two CP', () => {
    expect(getHolyNovaPower(5)).toBe(3);
    expect(getHolyNovaPower(6)).toBe(3);
    expect(getHolyNovaPower(7)).toBe(4);
    expect(getHolyNovaPower(9)).toBe(5);
  });

  it('starts the prototype in the forest forage biome', () => {
    expect(DEFAULT_BIOME).toMatchObject({
      id: 'forest',
      label: 'Forest',
      objectiveLabel: 'Forage',
    });
    expect(DEFAULT_BIOME.resources).toEqual(['Wood', 'Berries', 'Herbs']);
  });
});
