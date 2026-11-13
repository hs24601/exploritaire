import { expect, it } from 'vitest';
import { statusDetail } from './BattleStatusIcons';
import { createCombatSandboxScenario } from '../rules/battle';
import { STATUS_META } from '../rules/battleStatusData';

it('uses authored buff details for inspection and preserves the dynamic fallback', () => {
  const battle = createCombatSandboxScenario('1000');
  const original = STATUS_META.duskscale.description;
  try {
    const dynamic = statusDetail({ id: 'duskscale' }, battle.foes[0], battle, false);
    expect(dynamic).toContain('stagger');
    STATUS_META.duskscale.description = 'Scales prevent stagger until the dragon casts.';
    expect(statusDetail({ id: 'duskscale' }, battle.foes[0], battle)).toBe(STATUS_META.duskscale.description);
    expect(statusDetail({ id: 'duskscale' }, battle.foes[0], battle, false)).toBe(dynamic);
    STATUS_META.duskscale.description = '';
    expect(statusDetail({ id: 'duskscale' }, battle.foes[0], battle)).toBe(dynamic);
  } finally {
    STATUS_META.duskscale.description = original;
  }
});
