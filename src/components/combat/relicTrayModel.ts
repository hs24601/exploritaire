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
    const items: RelicTrayItem[] = [];
    definitions.forEach((definition) => {
      const instance = instancesByRelicId.get(definition.id);
      const enabled = !!instance?.enabled;
      if (enabledOnly && !enabled) return;
      items.push({
        instanceId: instance?.instanceId ?? `relic-${definition.id}`,
        relicId: definition.id,
        behaviorId: definition.behaviorId,
        name: definition.name,
        description: definition.description,
        rarity: definition.rarity,
        level: instance?.level ?? 1,
        params: definition.params,
        enabled,
      });
    });
    return items;
  }

  const items: RelicTrayItem[] = [];
  instances.forEach((instance) => {
    const definition = definitionsById.get(instance.relicId);
    if (!definition) return;
    if (enabledOnly && !instance.enabled) return;
    items.push({
      instanceId: instance.instanceId,
      relicId: definition.id,
      behaviorId: definition.behaviorId,
      name: definition.name,
      description: definition.description,
      rarity: definition.rarity,
      level: instance.level ?? 1,
      params: definition.params,
      enabled: !!instance.enabled,
    });
  });
  return items;
}
