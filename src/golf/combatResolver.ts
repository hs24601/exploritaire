import type { Element } from '../engine/types';

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type ElementalShieldMap = Partial<Record<Element, number>>;

export type SuperArmorKind = 'bulwark' | 'ward' | 'reactive';

export type ActorCombatState = {
  hp: number;
  hpMax: number;
  armor: number;
  defense: number;
  defenseBuffAmount: number;
  evasion: number;
  evasionBuffAmount: number;
  superArmorBulwark: number;
  superArmorWard: number;
  superArmorReactive: number;
  elementalShields: ElementalShieldMap;
  defenseBuffTurns: number;
  evasionBuffTurns: number;
  burn: number;
  doomCounter: number | null;
  harmfulTickMeter: number;
  beneficialTickMeter: number;
  counterWindow: number;
  counterDamage: number;
  consecutiveHitsTaken: number;
  dodgeCounter: number;
  slow: number;
  haste: number;
  staggerPressure: number;
  whiskersense?: number;
  momentum?: number;
  narrowEscape?: number;
  skittish?: number;
  wildSpirit?: number;
  forecastIntent: boolean;
};

export type DamagePacket = {
  physical: number;
  elemental: Partial<Record<Element, number>>;
  deliberate: boolean;
  threshold: number;
  source: 'player' | 'enemy';
  sourceActor: string;
  targetActor: string;
};

export type ResolveDamagePacketResult<TCombatant extends ActorCombatState> = {
  combatants: Record<string, TCombatant>;
  damageDealt: number;
  dodged: boolean;
  superArmorTriggered: SuperArmorKind | null;
};

type ResolverOptions = {
  random?: () => number;
  supportAllyKeys?: string[];
};

const DEFAULT_SUPPORT_ALLY_KEYS = ['jet', 'hero', 'pan', 'whis'];

export function getTotalPacketDamage(packet: DamagePacket) {
  return packet.physical + Object.values(packet.elemental).reduce((sum, value) => sum + (value ?? 0), 0);
}

export function applyCounterWindowToPacket<
  TCombatant extends ActorCombatState,
  TState extends { combatants: Record<string, TCombatant> },
>(state: TState, packet: DamagePacket): { state: TState; packet: DamagePacket } {
  const source = state.combatants[packet.sourceActor];
  if (!source || source.counterWindow <= 0 || source.counterDamage <= 0) {
    return { state, packet };
  }

  return {
    state: {
      ...state,
      combatants: {
        ...state.combatants,
        [packet.sourceActor]: {
          ...source,
          counterWindow: 0,
          counterDamage: 0,
        },
      },
    } as TState,
    packet: {
      ...packet,
      physical: packet.physical + source.counterDamage,
    },
  };
}

export function resolveDamagePacket<TCombatant extends ActorCombatState>(
  combatants: Record<string, TCombatant>,
  packet: DamagePacket,
  options: ResolverOptions = {},
): ResolveDamagePacketResult<TCombatant> {
  const target = combatants[packet.targetActor];
  const source = combatants[packet.sourceActor];
  if (!target) return { combatants, damageDealt: 0, dodged: false, superArmorTriggered: null };

  const nextTarget: TCombatant = {
    ...target,
    elementalShields: { ...target.elementalShields },
    dodgeCounter: target.dodgeCounter,
  };
  const nextSource = source
    ? {
        ...source,
        elementalShields: { ...source.elementalShields },
      }
    : null;

  const roll = options.random ?? Math.random;
  const supportAllyKeys = options.supportAllyKeys ?? DEFAULT_SUPPORT_ALLY_KEYS;
  const evasionChance = clampNumber(nextTarget.evasion + (nextTarget.haste * 6) - (nextTarget.slow * 4), 0, 85);
  if (roll() * 100 < evasionChance) {
    nextTarget.dodgeCounter += 1;
    nextTarget.counterWindow = Math.max(nextTarget.counterWindow, nextTarget.haste > 0 ? 2 : 1);
    nextTarget.counterDamage = Math.max(nextTarget.counterDamage, 2 + Math.min(2, nextTarget.haste));
    const updated = { ...combatants, [packet.targetActor]: nextTarget };
    return { combatants: nextSource ? { ...updated, [packet.sourceActor]: nextSource } : updated, damageDealt: 0, dodged: true, superArmorTriggered: null };
  }

  const elemental: Partial<Record<Element, number>> = { ...packet.elemental };
  (Object.keys(elemental) as Element[]).forEach((element) => {
    if ((elemental[element] ?? 0) <= 0) return;
    if ((nextTarget.elementalShields[element] ?? 0) > 0) {
      nextTarget.elementalShields[element] = Math.max(0, (nextTarget.elementalShields[element] ?? 0) - 1);
      elemental[element] = 0;
    }
  });

  let total = packet.physical + Object.values(elemental).reduce((sum, value) => sum + (value ?? 0), 0);
  let superArmorTriggered: SuperArmorKind | null = null;
  if (total >= packet.threshold) {
    if (nextTarget.superArmorBulwark > 0) {
      nextTarget.superArmorBulwark -= 1;
      superArmorTriggered = 'bulwark';
      total = 0;
    } else if (nextTarget.superArmorWard > 0) {
      nextTarget.superArmorWard -= 1;
      superArmorTriggered = 'ward';
      total = 0;
    } else if (nextTarget.superArmorReactive > 0) {
      nextTarget.superArmorReactive -= 1;
      superArmorTriggered = 'reactive';
      total = 0;
    }
  }

  if (superArmorTriggered === null) {
    total = Math.max(0, total - nextTarget.defense);
    const armorBlocked = Math.min(nextTarget.armor, total);
    nextTarget.armor -= armorBlocked;
    total -= armorBlocked;
    nextTarget.hp = Math.max(0, nextTarget.hp - total);
    nextTarget.consecutiveHitsTaken += 1;
  } else {
    nextTarget.consecutiveHitsTaken = 0;
  }

  const nextCombatants: Record<string, TCombatant> = {
    ...combatants,
    [packet.targetActor]: nextTarget,
  };
  if (superArmorTriggered === 'bulwark') {
    supportAllyKeys.forEach((allyKey) => {
      const ally = nextCombatants[allyKey];
      if (!ally) return;
      nextCombatants[allyKey] = { ...ally, armor: ally.armor + 5 };
    });
  } else if (superArmorTriggered === 'ward') {
    supportAllyKeys.forEach((allyKey) => {
      const ally = nextCombatants[allyKey];
      if (!ally) return;
      nextCombatants[allyKey] = { ...ally, evasion: ally.evasion + 6 };
    });
    if (nextSource) {
      nextCombatants[packet.sourceActor] = { ...nextSource, slow: nextSource.slow + 1 };
    }
  } else if (superArmorTriggered === 'reactive') {
    if (nextSource) {
      nextCombatants[packet.sourceActor] = { ...nextSource, hp: Math.max(0, nextSource.hp - 3) };
    }
  }

  return { combatants: nextCombatants, damageDealt: total, dodged: false, superArmorTriggered };
}
