import authored from '../../data/combatAbilityOverrides.json';

// Authored edits to combat ability cards (?combatAbilities), keyed by stable
// ability id so renames never break scenario hands. Applied when the ability
// data loads; saved through the dev-only /__combat-abilities/save route.
// Pure and import-light so battleStatusData can stay free of battle.ts.

export type AbilityOwner = 'hero' | 'mochi';
export type AbilityOverride = { name?: string; owner?: AbilityOwner; description?: string };
export type AbilityOverrides = Record<string, AbilityOverride>;
export const ABILITY_OVERRIDES = authored as AbilityOverrides;
export const ABILITY_OWNERS: readonly AbilityOwner[] = ['hero', 'mochi'];
export const ABILITY_NAME_MAX = 40;
export const ABILITY_DESCRIPTION_MAX = 400;

type Editable = { name: string; actorId: string; description: string; card?: string };
/** Cards whose rules are tied to their owner (Cir, Withdraw, Sticky Paws) keep it; Cir is not editable at all. */
export const abilityEdits = (id: string) => ({ text: !id.startsWith('cir'), owner: !id.startsWith('cir') && id !== 'withdraw' && id !== 'sticky-paws' });

/** Overrides replace the name, the owner (whose AP pays and whose radial shows it) and the card/rules text. */
export function applyAbilityOverrides<T extends Record<string, Editable>>(base: T, overrides: AbilityOverrides = ABILITY_OVERRIDES): T {
  const next: Record<string, Editable> = { ...base };
  for (const [id, override] of Object.entries(overrides)) {
    const entry = next[id];
    if (!entry || !override) continue;
    const edits = abilityEdits(id);
    if (!edits.text) continue;
    next[id] = { ...entry,
      ...(override.name?.trim() ? { name: override.name.trim() } : {}),
      ...(override.description?.trim() ? { description: override.description.trim(), ...('card' in entry ? { card: override.description.trim() } : {}) } : {}),
      ...(edits.owner && override.owner && ABILITY_OWNERS.includes(override.owner) ? { actorId: override.owner } : {}) };
  }
  return next as T;
}

/** Returns an error message, or null when the draft can be saved. Names are unique within their owner. */
export function validateAbilityOverride(id: string, draft: Required<AbilityOverride>, abilities: { id: string; name: string; owner: string }[]): string | null {
  const name = draft.name.trim();
  if (!abilityEdits(id).text) return 'This ability can’t be edited.';
  if (!name) return 'Name can’t be empty.';
  if (name.length > ABILITY_NAME_MAX) return `Name must be ${ABILITY_NAME_MAX} characters or fewer.`;
  if (!draft.description.trim()) return 'Description can’t be empty.';
  if (draft.description.length > ABILITY_DESCRIPTION_MAX) return `Description must be ${ABILITY_DESCRIPTION_MAX} characters or fewer.`;
  if (!ABILITY_OWNERS.includes(draft.owner)) return 'Choose Hero or Mochi.';
  const clash = abilities.find(other => other.id !== id && other.owner === draft.owner && other.name.trim().toLowerCase() === name.toLowerCase());
  return clash ? `${draft.owner === 'hero' ? 'Hero' : 'Mochi'} already has an ability named “${clash.name}”.` : null;
}
