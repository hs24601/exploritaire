import type { GameState } from '../../engine/types';
import type { RelicTrayItem } from './RelicTray';
import type { RelicInstanceLike } from './contracts';

interface BuildRelicTrayItemsOptions {
  enabledOnly?: boolean;
  includeAllDefinitions?: boolean;
}

type RelicDefinitionLike = {
  id: string;
  behaviorId: string;
  name: string;
  description?: string;
  rarity?: string;
  params?: Record<string, unknown>;
};

export function buildRelicTrayItems(
  gameState: GameState,
  options?: BuildRelicTrayItemsOptions
): RelicTrayItem[] {
  const enabledOnly = !!options?.enabledOnly;
  const includeAllDefinitions = options?.includeAllDefinitions ?? true;
  const stateWithRelics = gameState as GameState & {
    relicDefinitions?: RelicDefinitionLike[];
    equippedRelics?: RelicInstanceLike[];
  };
  const definitions = stateWithRelics.relicDefinitions ?? [];
  const instances = stateWithRelics.equippedRelics ?? [];
  const instancesByRelicId = new Map(instances.map((instance) => [instance.relicId, instance]));
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));

  if (includeAllDefinitions) {
    return definitions
      .map((definition) => {
        const instance = instancesByRelicId.get(definition.id);
        const enabled = !!instance?.enabled;
        if (enabledOnly && !enabled) return null;
        return {
          instanceId: instance?.instanceId ?? `relic-${definition.id}`,
          relicId: definition.id,
          behaviorId: definition.behaviorId,
          name: definition.name,
          description: definition.description,
          rarity: definition.rarity,
          level: instance?.level ?? 1,
          params: definition.params,
          enabled,
        } satisfies RelicTrayItem;
      })
      .filter((item): item is RelicTrayItem => !!item);
  }

  return instances
    .map((instance) => {
      const definition = definitionsById.get(instance.relicId);
      if (!definition) return null;
      if (enabledOnly && !instance.enabled) return null;
      return {
        instanceId: instance.instanceId,
        relicId: definition.id,
        behaviorId: definition.behaviorId,
        name: definition.name,
        description: definition.description,
        rarity: definition.rarity,
        level: instance.level ?? 1,
        params: definition.params,
        enabled: !!instance.enabled,
      } satisfies RelicTrayItem;
    })
    .filter((item): item is RelicTrayItem => !!item);
}
