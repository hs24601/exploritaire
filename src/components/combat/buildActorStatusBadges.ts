import type { Actor, GameState } from '../../engine/types';
import { getActorDefinition } from '../../engine/actors';
import type { StatusBadgeData } from './StatusBadges';

export type StatusSide = 'player' | 'enemy';

interface BuildActorStatusBadgesOptions {
  nowMs?: number;
  requireRpgMode?: boolean;
}

function inferDefinitionIdFromOrimInstanceId(state: GameState, instanceId: string): string | null {
  if (state.orimDefinitions.some((entry) => entry.id === instanceId)) return instanceId;
  const fromInstance = state.orimInstances[instanceId]?.definitionId;
  if (fromInstance) return fromInstance;
  const parsed = instanceId.match(/^orim-(.+)-\d{10,16}-[a-z0-9]+$/i)?.[1];
  if (parsed) return parsed;
  const byContains = state.orimDefinitions.find((entry) => instanceId.includes(`orim-${entry.id}-`));
  return byContains?.id ?? null;
}

function getActorAbilityDescriptions(state: GameState, actorId: string): Array<{
  id: string;
  description: string;
  effectTypes: string[];
}> {
  const deck = state.actorDecks[actorId];
  if (!deck) return [];
  const rows: Array<{ id: string; description: string; effectTypes: string[] }> = [];
  deck.cards.forEach((deckCard) => {
    deckCard.slots.forEach((slot) => {
      if (!slot.orimId) return;
      const defId = inferDefinitionIdFromOrimInstanceId(state, slot.orimId);
      if (!defId) return;
      const def = state.orimDefinitions.find((entry) => entry.id === defId);
      if (!def) return;
      rows.push({
        id: def.id,
        description: String(def.description ?? '').trim(),
        effectTypes: (def.effects ?? []).map((fx) => String(fx.type ?? '').trim().toLowerCase()).filter(Boolean),
      });
    });
  });
  return rows;
}

function findAbilityDescriptionForStatus(
  state: GameState,
  actorId: string,
  options: {
    effectTypes?: string[];
    idHints?: string[];
    textHints?: string[];
  }
): string | undefined {
  const rows = getActorAbilityDescriptions(state, actorId);
  if (rows.length === 0) return undefined;
  const effectSet = new Set((options.effectTypes ?? []).map((key) => key.toLowerCase()));
  const idHints = (options.idHints ?? []).map((hint) => hint.toLowerCase());
  const textHints = (options.textHints ?? []).map((hint) => hint.toLowerCase());
  const matched = rows.find((row) => {
    if (effectSet.size > 0 && row.effectTypes.some((fx) => effectSet.has(fx))) return true;
    if (idHints.length > 0 && idHints.some((hint) => row.id.toLowerCase().includes(hint))) return true;
    const desc = row.description.toLowerCase();
    if (textHints.length > 0 && textHints.some((hint) => desc.includes(hint))) return true;
    return false;
  });
  if (matched?.description) return matched.description;

  const globalMatch = state.orimDefinitions.find((def) => {
    const id = String(def.id ?? '').toLowerCase();
    const desc = String(def.description ?? '').toLowerCase();
    const effectTypes = (def.effects ?? []).map((fx) => String(fx.type ?? '').trim().toLowerCase());
    if (effectSet.size > 0 && effectTypes.some((fx) => effectSet.has(fx))) return true;
    if (idHints.length > 0 && idHints.some((hint) => id.includes(hint))) return true;
    if (textHints.length > 0 && textHints.some((hint) => desc.includes(hint))) return true;
    return false;
  });
  return globalMatch?.description || undefined;
}

function getEquippedOrimDefinitionsForActor(state: GameState, actor: Actor): Array<{ id: string; name: string; description: string; legacyOrim?: boolean; timerBonusMs?: number }> {
  const resolved: Array<{ id: string; name: string; description: string; legacyOrim?: boolean; timerBonusMs?: number }> = [];
  (actor.orimSlots ?? []).forEach((slot) => {
    if (!slot.orimId) return;
    const definitionId = inferDefinitionIdFromOrimInstanceId(state, slot.orimId);
    if (!definitionId) return;
    const definition = state.orimDefinitions.find((entry) => entry.id === definitionId);
    if (!definition) return;
    resolved.push({
      id: definition.id,
      name: String(definition.name ?? definition.id),
      description: String(definition.description ?? '').trim(),
      legacyOrim: definition.legacyOrim,
      timerBonusMs: Math.max(0, Number(definition.timerBonusMs ?? 0)),
    });
  });
  return resolved;
}

export function buildActorStatusBadges(
  gameState: GameState,
  actor: Actor | null | undefined,
  side: StatusSide,
  options?: BuildActorStatusBadgesOptions
): StatusBadgeData[] {
  if (!actor) return [];
  if (options?.requireRpgMode && gameState.playtestVariant !== 'rpg') return [];

  const nowMs = options?.nowMs ?? Date.now();
  const statuses: StatusBadgeData[] = [];
  const equippedOrims = getEquippedOrimDefinitionsForActor(gameState, actor);
  const byDefinition = new Map<string, { id: string; name: string; description: string; legacyOrim?: boolean; timerBonusMs?: number; count: number }>();
  equippedOrims.forEach((definition) => {
    const current = byDefinition.get(definition.id);
    if (current) {
      current.count += 1;
      return;
    }
    byDefinition.set(definition.id, { ...definition, count: 1 });
  });
  Array.from(byDefinition.values()).forEach((definition) => {
    const isVisibleBuff = !definition.legacyOrim || (definition.timerBonusMs ?? 0) > 0;
    if (!isVisibleBuff) return;
    const totalTimerBonusMs = Math.max(0, Number(definition.timerBonusMs ?? 0)) * Math.max(1, definition.count);
    const detail = totalTimerBonusMs > 0
      ? `+${(totalTimerBonusMs / 1000).toFixed(1)}s on valid foundation play${definition.count > 1 ? ` (x${definition.count})` : ''}`
      : (definition.count > 1 ? `Equipped x${definition.count}` : 'Equipped');
    statuses.push({
      id: `orim-${side}-${actor.id}-${definition.id}`,
      kind: 'buff',
      label: definition.name,
      detail,
      sourceDescription: definition.description || undefined,
    });
  });

  const actorDefinition = getActorDefinition(actor.definitionId ?? '');
  const baseEvasion = Math.max(0, Number(actorDefinition?.baseEvasion ?? 0));
  const bonusEvasion = Math.max(0, Math.round((actor.evasion ?? 0) - baseEvasion));
  if (bonusEvasion > 0) {
    statuses.push({
      id: `evasion-${side}-${actor.id}`,
      kind: 'buff',
      label: 'Evasion',
      detail: `+${bonusEvasion} evasion`,
      sourceDescription: findAbilityDescriptionForStatus(gameState, actor.id, {
        effectTypes: ['evasion', 'defense'],
        idHints: ['ironfur'],
      }),
    });
  }

  const slowUntil = gameState.rpgEnemyDragSlowUntil ?? 0;
  if (side === 'enemy' && gameState.rpgEnemyDragSlowActorId === actor.id && slowUntil > nowMs) {
    statuses.push({
      id: `slow-${side}-${actor.id}`,
      kind: 'debuff',
      label: 'Slow',
      detail: 'Drag speed reduced by 90%',
      sourceDescription: findAbilityDescriptionForStatus(gameState, actor.id, {
        idHints: ['peck'],
        textHints: ['slow', 'drag'],
      }),
      remainingMs: slowUntil - nowMs,
      totalMs: 3000,
    });
  }

  const cloudUntil = gameState.rpgCloudSightUntil ?? 0;
  if (side === 'player' && gameState.rpgCloudSightActorId === actor.id && cloudUntil > nowMs) {
    statuses.push({
      id: `cloud-${side}-${actor.id}`,
      kind: 'buff',
      label: 'Cloud Sight',
      detail: 'Second tableau row revealed',
      sourceDescription: findAbilityDescriptionForStatus(gameState, actor.id, {
        idHints: ['cloud', 'sight'],
        textHints: ['reveal', 'tableau'],
      }),
      remainingMs: cloudUntil - nowMs,
      totalMs: 10000,
    });
  }

  const blindLevel = side === 'enemy'
    ? Math.max(0, Number(gameState.rpgBlindedEnemyLevel ?? 0))
    : Math.max(0, Number(gameState.rpgBlindedPlayerLevel ?? 0));
  const blindUntil = side === 'enemy'
    ? Math.max(0, Number(gameState.rpgBlindedEnemyUntil ?? 0))
    : Math.max(0, Number(gameState.rpgBlindedPlayerUntil ?? 0));
  if (blindLevel > 0 && blindUntil > nowMs) {
    const blindLabel = blindLevel >= 3 ? 'Blinded III' : (blindLevel === 2 ? 'Blinded II' : 'Blinded I');
    const blindDetail = blindLevel >= 3
      ? 'Most tableau values hidden'
      : (blindLevel === 2 ? 'Some tableau values hidden' : 'Mild sight disruption');
    statuses.push({
      id: `blind-${side}-${actor.id}`,
      kind: 'debuff',
      label: blindLabel,
      detail: blindDetail,
      sourceDescription: findAbilityDescriptionForStatus(gameState, actor.id, {
        idHints: ['blind'],
        textHints: ['blind'],
      }),
      remainingMs: blindUntil - nowMs,
      totalMs: 10000,
    });
  }

  (gameState.rpgDots ?? []).forEach((dot) => {
    if (dot.targetActorId !== actor.id || dot.targetSide !== side || dot.remainingTicks <= 0) return;
    const remainingMs = Math.max(
      0,
      (dot.nextTickAt - nowMs) + Math.max(0, dot.remainingTicks - 1) * dot.intervalMs
    );
    statuses.push({
      id: dot.id,
      kind: 'debuff',
      label: dot.effectKind === 'bleed' ? 'Bleed' : 'Vice Grip',
      detail: `${dot.damagePerTick} damage/sec (${dot.remainingTicks} ticks left)`,
      sourceDescription: findAbilityDescriptionForStatus(gameState, actor.id, {
        effectTypes: [dot.effectKind === 'bleed' ? 'bleed' : 'damage'],
        idHints: dot.effectKind === 'bleed' ? ['bite', 'bleed'] : ['vice'],
      }),
      remainingMs,
      totalMs: Math.max(1, (dot.initialTicks ?? dot.remainingTicks) * dot.intervalMs),
    });
  });

  return statuses;
}
