import { MOMENTUM_SKILLS, createCombatSandboxScenario, isCirMomentumSkill, skillOwner, type BattleState, type MomentumSkillId } from './battle';
import { COMBAT_SANDBOX_SCENARIOS } from './battleSandboxScenarios';
import { STATUS_META, STATUS_SKILLS, isStatusSkill, type StatusId } from './battleStatusData';
import { tutorialById } from './battleTutorialScenarios';
import { abilityEdits } from './abilityOverrides';

// The ?combatAbilities browser's view of the live ability data. Entries come
// from MOMENTUM_SKILLS (which includes the status cards and authored
// overrides), so new cards appear automatically. Pure: no React or DOM.

/** Kin ability cards a scenario deals into its radials (Withdraw lives in the Momentum radial). */
export function scenarioHand(battle: BattleState): MomentumSkillId[] {
  const hand = tutorialById(battle.tutorial?.id)?.skills;
  if (hand) return [...hand];
  return (Object.keys(MOMENTUM_SKILLS) as MomentumSkillId[]).filter(id => id !== 'cir' && id !== 'withdraw' && !isStatusSkill(id)
    && (!battle.night || !isCirMomentumSkill(id)) && (isCirMomentumSkill(id) || ['005', '006', '007'].includes(battle.sandboxScenario ?? '')));
}

export type AbilityElement = 'physical' | 'fire' | 'frost' | 'water' | 'shock' | 'nature' | 'none';
/** Element, statuses applied and tags per card. A card missing here still appears (element "none"). */
const TRAITS: Partial<Record<MomentumSkillId, { element: AbilityElement; applies?: StatusId[]; tags?: string[] }>> = {
  withdraw: { element: 'none', tags: ['Tableau', 'Ends turn'] },
  bash: { element: 'physical', tags: ['Stagger'] },
  pounce: { element: 'physical', tags: ['Damage', '×2 vs staggered'] },
  'sticky-paws': { element: 'physical', tags: ['Steal', 'Disarm'] },
  'cir-hearthflame': { element: 'fire', tags: ['Keru', 'Bind', 'Retaliate'] },
  'cir-ember-claws': { element: 'fire', tags: ['Keru', 'Bind'] },
  'cir-meteor': { element: 'fire', tags: ['Keru', 'Damage', 'Exhausts Cir'] },
  bite: { element: 'physical', applies: ['bleed', 'exposed'] },
  takedown: { element: 'physical', applies: ['stun'], tags: ['Shatter'] },
  'vice-grip': { element: 'physical', applies: ['grip'], tags: ['Commits all AP'] },
  'frost-fang': { element: 'frost', applies: ['chill', 'rime'], tags: ['Freeze'] },
  'thunder-bark': { element: 'shock', tags: ['Conduct'] },
  guard: { element: 'none', applies: ['guard'] },
  regen: { element: 'nature', applies: ['regen'], tags: ['Heal'] },
  foresight: { element: 'none', applies: ['foresight'], tags: ['Tableau'] },
  'ember-rage': { element: 'fire', applies: ['ember-rage'], tags: ['Rage', 'AP cap 12'] },
  'focus-fire': { element: 'fire', tags: ['Tableau', 'Burn rank', 'All foes'] },
  lacerate: { element: 'physical', applies: ['bleed'] },
  'puddle-pounce': { element: 'water', applies: ['soaked'], tags: ['Freeze', 'Steam', 'Conduct'] },
  'ember-swipe': { element: 'fire', applies: ['burn'], tags: ['Steam', 'Cauterize'] },
  haste: { element: 'none', applies: ['haste'], tags: ['Double AP'] },
  mire: { element: 'nature', applies: ['slow'] },
  wild: { element: 'none', applies: ['wild'], tags: ['Tableau'] },
};

export type AbilityGroup = 'hero' | 'mochi' | 'cir' | 'team';
export const GROUP_LABEL: Record<AbilityGroup, string> = { hero: 'Hero', mochi: 'Mochi', cir: 'Cir', team: 'Team' };
export type AbilityEntry = {
  id: MomentumSkillId; name: string; group: AbilityGroup; payer: 'hero' | 'mochi' | 'team';
  cost: number; costLabel: string; card: string; description: string; element: AbilityElement;
  statuses: string[]; tags: string[]; target: string; scenarios: { id: string; name: string }[];
  editable: { text: boolean; owner: boolean };
};

let hands: Map<string, Set<MomentumSkillId>> | null = null;
/** Which scenarios deal each card, computed from each scenario's real starting state. */
function scenarioHands() {
  if (hands) return hands;
  hands = new Map();
  for (const scenario of COMBAT_SANDBOX_SCENARIOS) {
    const battle = createCombatSandboxScenario(scenario.id);
    hands.set(scenario.id, new Set([...scenarioHand(battle), ...(battle.night ? [] : ['withdraw' as const])]));
  }
  return hands;
}

export function abilityCatalog(): AbilityEntry[] {
  const dealt = scenarioHands();
  return (Object.keys(MOMENTUM_SKILLS) as MomentumSkillId[]).filter(id => id !== 'cir').map(id => {
    const skill = MOMENTUM_SKILLS[id], status = isStatusSkill(id) ? STATUS_SKILLS[id] : null;
    const payer = skillOwner(id), traits = TRAITS[id];
    const group: AbilityGroup = isCirMomentumSkill(id) ? 'cir' : payer;
    const currency = id === 'withdraw' ? 'Momentum' : 'AP';
    const spendsAll = Boolean(status && 'spendsAll' in status && status.spendsAll);
    return {
      id, name: skill.name, group, payer, cost: skill.cost, costLabel: `${skill.cost}${spendsAll ? '+' : ''} ${currency}`,
      card: status ? status.card : skill.description, description: skill.description, element: traits?.element ?? 'none',
      statuses: (traits?.applies ?? []).map(statusId => STATUS_META[statusId].name), tags: traits?.tags ?? [],
      target: id === 'withdraw' ? 'Tableau' : status ? ({ foe: 'Foe', ally: 'Ally', self: 'Self', card: 'Tableau card' } as const)[status.target] : id === 'sticky-paws' ? 'Self' : id.startsWith('cir-') ? (id === 'cir-meteor' ? 'Foe' : 'Ally') : 'Foe',
      scenarios: COMBAT_SANDBOX_SCENARIOS.filter(scenario => dealt.get(scenario.id)?.has(id)).map(scenario => ({ id: scenario.id, name: scenario.name })),
      editable: abilityEdits(id),
    };
  });
}

export type AbilityFilter = { query: string; actors: string[]; effects: string[]; elements: string[]; costs: string[] };
export const EMPTY_FILTER: AbilityFilter = { query: '', actors: [], effects: [], elements: [], costs: [] };
const haystack = (entry: AbilityEntry) => [entry.name, GROUP_LABEL[entry.group], GROUP_LABEL[entry.payer as AbilityGroup], entry.element, entry.costLabel,
  entry.card, entry.description, entry.target, ...entry.statuses, ...entry.tags].join(' ').toLowerCase();

/** Every search word must match some field; chips combine with AND across kinds and OR within a kind. */
export function filterAbilities(entries: readonly AbilityEntry[], filter: AbilityFilter) {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    const text = haystack(entry);
    return words.every(word => text.includes(word))
      && (!filter.actors.length || filter.actors.includes(entry.group))
      && (!filter.effects.length || filter.effects.some(effect => entry.statuses.includes(effect) || entry.tags.includes(effect)))
      && (!filter.elements.length || filter.elements.includes(entry.element))
      && (!filter.costs.length || filter.costs.includes(entry.costLabel));
  });
}

/** Chip choices present in the data. */
export function abilityFacets(entries: readonly AbilityEntry[]) {
  const unique = (values: string[]) => [...new Set(values)];
  return {
    actors: (['hero', 'mochi', 'cir', 'team'] as AbilityGroup[]).filter(group => entries.some(entry => entry.group === group)),
    effects: unique(entries.flatMap(entry => [...entry.statuses, ...entry.tags])).sort(),
    elements: unique(entries.map(entry => entry.element)).sort(),
    costs: unique(entries.map(entry => entry.costLabel)).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b)),
  };
}
