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
  const quest: SequentialQuest = { id: 'day01.tutorial', title: 'Before dark', steps: [
    { id: 'navigate-den', title: 'Find a way out', text: 'Play cards one rank higher or lower than Hero’s card to guide her out of the den.', complete: navigated },
    { id: 'first-berry', title: 'Pick the first berry', text: 'Keep playing cards to reach the nearby bush and collect its manaberry.', complete: sparse },
    { id: 'denser-patch', title: 'Khad Roots', text: 'Dark vines with dangerous-looking thorns have wrapped around parts of the bushes. Look elsewhere for more manaberries.', complete: patch },
    { id: 'gather-supper', title: 'Gather supper', text: 'Play the gathering tableau to collect two more mana: enough for supper and a little light.', complete: gathered },
    { id: 'return-home', title: 'Head home', text: 'Guide Hero back to her den with the gathered mana.', complete: home },
    { id: 'supper', title: 'Have supper', text: 'Have supper at home to prepare for the night.', complete: supper },
    { id: 'rest', title: 'Curl up', text: 'Choose Curl up, then play the Zzz tableau to finish the day.', complete: rested },
  ] };
  const active=quest.steps[firstUnfinishedSubtask(quest)];
  quest.awaitingDiscovery=!!active && !state.discoveredTutorialQuests?.includes(active.id) && !(active.id==='navigate-den' && state.denQuestDiscovered);
  return quest;
}

export function pendingTutorialQuest(state: ProtoState): QuestSubtask | undefined {
  if(state.dayScenario!=='day01')return;
  const quest=dayOneTutorialQuest(state);
  // The first instruction arrives when travel starts; the opening has no pickup.
  if (!state.journey && quest.steps[firstUnfinishedSubtask(quest)]?.id === 'navigate-den') return;
  return quest.awaitingDiscovery ? quest.steps[firstUnfinishedSubtask(quest)] : undefined;
}

export const firstUnfinishedSubtask = (quest: SequentialQuest) => {
  const index = quest.steps.findIndex(step => !step.complete);
  return index < 0 ? quest.steps.length : index;
};

/** Painted acknowledgement, face-down turnover, receipt flight, then the next face. */
export function questCardTransition(elapsed: number, reduced = false) {
  const checkMs = reduced ? 100 : 650, tapMs = reduced ? 50 : 300, receiveMs = reduced ? 120 : 650, flipMs = reduced ? 120 : 650;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const flightEnd = checkMs + tapMs + receiveMs;
  return { phase: elapsed < checkMs ? 'check' : elapsed < checkMs + tapMs ? 'tap' : elapsed < flightEnd ? 'receive' : elapsed < flightEnd + flipMs ? 'flip' : 'idle',
    check: clamp(elapsed / checkMs), tap: clamp((elapsed - checkMs) / tapMs), receive: clamp((elapsed - checkMs - tapMs) / receiveMs), flip: clamp((elapsed - flightEnd) / flipMs) } as const;
}

export function khadCalloutHeld(state: ProtoState) {
  if (state.dayScenario !== 'day01') return false;
  const quest = dayOneTutorialQuest(state);
  return quest.steps[firstUnfinishedSubtask(quest)]?.id === 'denser-patch' && !state.dockedTutorialQuests?.includes('denser-patch');
}
