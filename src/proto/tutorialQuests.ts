import type { ProtoState } from './protoState';
import { dayOneReturning } from './dayScenarios';

export type QuestSubtask = { id: string; title: string; text: string; complete: boolean };
export type SequentialQuest = { id: string; title: string; awaitingDiscovery?: boolean; steps: readonly QuestSubtask[] };

/** Requirements reflect real milestones, including later facts that imply an
 * earlier step was passed. Spending supper mana must not restore old cards. */
export function dayOneTutorialQuest(state: ProtoState): SequentialQuest {
  const hero = state.worldActors.find(actor => actor.id === 'hero');
  const at = (id?: string) => {
    const tile = state.biomeTiles.find(tile => tile.id === id);
    return Boolean(tile && hero && Math.hypot(hero.position.x - tile.position.x, hero.position.y - tile.position.y) < 1);
  };
  const rested = Boolean(state.ordinaryDay?.complete);
  const supper = Boolean(state.ordinaryDay?.supper) || rested;
  const home = supper || dayOneReturning(state) && at('hero-den');
  const gathered = home || dayOneReturning(state);
  const patch = gathered || at(state.dayScenarioTiles?.patchId);
  const sparse = patch || Boolean(state.biomeTiles.find(tile => tile.id === state.dayScenarioTiles?.sparsePatchId)?.berryHarvested);
  const exit = state.journey?.segments[0];
  const navigated = sparse || Boolean(exit?.kind === 'den-exit' && state.journey!.completed >= exit.cards);
  const departed = navigated || Boolean(state.journey);
  const quest: SequentialQuest = { id: 'day01.tutorial', title: 'Before dark', steps: [
    { id: 'leave-den', title: 'Leave the den', text: 'Leave the den.', complete: departed },
    { id: 'navigate-den', title: 'Find a way out', text: 'Play cards one rank higher or lower than Hero’s card to guide her out of the den.', complete: navigated },
    { id: 'first-berry', title: 'Pick the first berry', text: 'Keep playing cards to reach the nearby bush and collect its manaberry.', complete: sparse },
    { id: 'denser-patch', title: 'Visit the denser patch', text: 'Guide Hero to the denser berry patch.', complete: patch },
    { id: 'gather-supper', title: 'Gather supper', text: 'Play the gathering tableau to collect two more mana: enough for supper and a little light.', complete: gathered },
    { id: 'return-home', title: 'Head home', text: 'Guide Hero back to her den with the gathered mana.', complete: home },
    { id: 'supper', title: 'Have supper', text: 'Have supper at home to prepare for the night.', complete: supper },
    { id: 'rest', title: 'Curl up', text: 'Choose Curl up, then play the Zzz tableau to finish the day.', complete: rested },
  ] };
  const active=quest.steps[firstUnfinishedSubtask(quest)];
  quest.awaitingDiscovery=!!active && active.id!=='leave-den' && !state.discoveredTutorialQuests?.includes(active.id) && !(active.id==='navigate-den' && state.denQuestDiscovered);
  return quest;
}

export function pendingTutorialQuest(state: ProtoState): QuestSubtask | undefined {
  if(state.dayScenario!=='day01')return;
  const quest=dayOneTutorialQuest(state);
  return quest.awaitingDiscovery ? quest.steps[firstUnfinishedSubtask(quest)] : undefined;
}

export const firstUnfinishedSubtask = (quest: SequentialQuest) => {
  const index = quest.steps.findIndex(step => !step.complete);
  return index < 0 ? quest.steps.length : index;
};

export function questCardTransition(elapsed: number, reduced = false) {
  const burnMs = reduced ? 180 : 4000, flipMs = reduced ? 120 : 650;
  const t = Math.min(1, Math.max(0, (elapsed - burnMs) / flipMs));
  return { phase: elapsed < burnMs ? 'burn' : elapsed < burnMs + flipMs ? 'flip' : 'idle',
    burn: Math.min(1, elapsed / burnMs), flip: t * t * (3 - 2 * t) } as const;
}
