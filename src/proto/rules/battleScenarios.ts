import type { BattleSetup } from './battle';

// Battle scenarios for the Dark Woods selector: the basic fight plus small,
// playable takes on the advanced ideas (foes sharing the table, traps, spirits
// that bend legal play). Each is only setup data over the same rules.

export type BattleScenario = { id: string; name: string; blurb: string; setup: BattleSetup };

export const BATTLE_SCENARIOS: readonly BattleScenario[] = [
  { id: 'basic', name: 'Basic', blurb: 'Hero and Mochi against two slimes',
    setup: { mochi: true, slimes: 2 } },
  { id: 'hungry', name: 'Hungry slimes', blurb: 'Slimes eat from the table too: each card fed adds 1 to its next hit. Play an eyed card first to snatch it for +1 charge',
    setup: { mochi: true, slimes: 2, rules: { hungry: true } } },
  { id: 'traps', name: 'Booby traps', blurb: 'Hungry slimes, and abilities can be dropped on a table card as a trap: the slime that eats it takes ×1.5',
    setup: { mochi: true, slimes: 2, rules: { hungry: true, traps: true } } },
  { id: 'grove', name: 'Spirit grove', blurb: 'Three hungry slimes. Wisp lets Hero play cards two ranks away; Moss lets Mochi play a matching rank; Cal adds fire',
    setup: { mochi: true, slimes: 3, spirits: { hero: ['wisp', 'cal'], mochi: ['moss'] }, rules: { hungry: true } } },
];

export const scenarioById = (id: string) => BATTLE_SCENARIOS.find((scenario) => scenario.id === id) ?? BATTLE_SCENARIOS[0];
