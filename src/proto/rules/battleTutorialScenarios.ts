import type { StatusSkillId, UnitStatus } from './battleStatusData';
import type { KeruKit } from './keruInvokeData';

// Tutorial and focused combat-sandbox scenarios, as data over the turn-based
// combatsbx rules (rules/battleTutorials.ts builds them). Every enemy is a
// Khad Root. Each card a foundation receives banks 1 AP for that Kin (cap 6)
// and 1 shared Momentum; ability cards cost their owner's AP. Insight copy is
// the long-form explanation shown by the Insight buff on one party member.

export type TutorialScenarioId = '008' | '009' | '010' | '011' | '012' | '013' | '014' | '015' | '016' | '017' | '018' | '019' | '020' | '021' | '022' | '023' | '024' | '1000' | '1001' | '1002' | '1004' | '1005' | '1006' | '1007' | '1008' | '1009' | '1010' | '1012' | '111' | '100' | '101' | '102' | '103' | '104' | '105';
export type TutorialFoeDef = {
  key: string; name: string; hp: number; damage: number; staggerMax: number;
  /** Debuff placed on the Kin it strikes. */
  inflicts?: 'sap' | 'silence';
  /** Statuses it starts each wave with. */
  statuses?: UnitStatus[];
  /** Banks no Momentum and has no Heavy Strike (no Momentum buff). */
  noMomentum?: boolean;
  frostKit?: 'armor' | 'retort' | 'whiteout';
};
export type StrikeProfile = { name: string; damage: number; stagger: number };
/**
 * An enemy intent played as a golf card on the table (rules/battleDeadRun.ts).
 * Each enemy turn its owner plays up to `enemyPlays` matching tableau cards onto
 * it and adds `passive` pips; at `pips` it fires on every living Kin, then
 * returns as a fresh card. Each party card played on it removes a pip and earns
 * Momentum, but no AP and no hit. `fixedRank` keeps its rank when played on.
 */
export type IntentCardDef = { name: string; pips: number; enemyPlays: number; passive: number; damage: number; fixedRank?: boolean;
  /** Maximum positive pip progress per enemy turn, including passive gains. */
  maxProgressPerTurn?: number;
  /** A caster-built ability foundation: only its owner adds cards (the party can only deny them), it picks among matching cards at random, and it sits beside the owner. */
  casterOnly?: boolean;
  /** Party counterplay may remove pips while this caster-owned ability charges. */
  partyPlays?: boolean;
  /**
   * Ability template for a foundation that needs a waiting turn (like summoning sickness): at full pips it becomes a readied card in the
   * owner's hand instead of firing. The owner skips its next turn to wind up, then unleashes `damage` on every Kin on the turn after.
   */
  readies?: boolean;
  /** The owner starts behind stagger-proof armor (Duskscale Armor), casts the ability on its first turn and sheds the armor until the ability resolves or is choked. */
  armored?: boolean };
export type DeadRunFixes = Pick<TutorialDef, 'intentCard' | 'pityDraw' | 'holdSlot'>;
export type TutorialDef = {
  id: TutorialScenarioId;
  name: string;
  foes: TutorialFoeDef[];
  /** Defeated foes are replaced at once and counted as rounds completed. */
  endless?: { hpStep: number; damageEvery: number; staggerEvery: number; staggerCap: number };
  /** Ability cards in the Kin radials (Withdraw is always in the Momentum radial). Cir's three cards are named by id. */
  skills: readonly (StatusSkillId | 'bash' | 'pounce' | 'sticky-paws' | 'cir-hearthflame' | 'cir-ember-claws' | 'cir-meteor')[];
  /** Tableau-receipt hits; defaults to Nip/Claw at 1 damage and 1 stagger. */
  strikes?: Partial<Record<'hero' | 'mochi', StrikeProfile>>;
  partyHp?: number;
  /** Starting AP for every Kin, and shared Momentum. */
  ap?: number;
  momentum?: number;
  decay?: boolean;
  seed: number;
  /** An authored opening deal (ranks, buried first); otherwise a seeded deal. Refills always use the seeded stock. */
  deal?: number[][];
  /** Tableau columns (default 7) and the Kin who fight (default Hero and Mochi). */
  columns?: number;
  party?: readonly ('hero' | 'mochi' | 'dem' | 'cir' | 'banks')[];
  /** Dead-run fixes: an intent card on the table, one free stock flip when a turn opens dead, and one parked card per Kin. */
  intentCard?: IntentCardDef;
  pityDraw?: boolean;
  holdSlot?: boolean;
  /** Paced enemy turn: the board holds this many seconds, then each enemy action plays out in turn (battleTutorials ENEMY_STEP_SECONDS). */
  enemyTurnSeconds?: number;
  /** A fresh random deal on every start and restart instead of the authored seed. */
  randomSeed?: boolean;
  /** Tapping a Kin's foundation opens its ability radial (unwired elsewhere in combatsbx). */
  kinRadials?: boolean;
  /** Drop the empty foundation placeholder beside the party. */
  hideEmptySlot?: boolean;
  /** Elemental suits: one off-sequence play per party turn onto the Kin of the card's element (rules/elementSuits.ts). */
  elementSuits?: boolean;
  insight: { actorId: 'hero' | 'mochi'; intent: string[]; solve: string[]; why: string[] };
  /** Keru invoke cards in Hero's hand (rules/keruInvoke.ts). Empty: 1005's free-first untiered invoke. `load`: stacking within a load budget (1010–1011); `upkeep`: 1012's per-turn AP upkeep. */
  keru?: { rarity?: KeruKit; cost?: number; refill?: boolean; slots?: number; seal?: number; load?: number; upkeep?: boolean; cast?: boolean };
  /** Show the scenario notes panel even on a truefourstar board. */
  notes?: boolean;
  /** A readying intent opens already charging with this many pips (instead of behind its armor). */
  breathStart?: number;
};

const ALL_SKILLS = ['bash', 'ember-rage', 'focus-fire', 'bite', 'takedown', 'vice-grip', 'frost-fang', 'thunder-bark', 'guard', 'regen', 'foresight',
  'hold', 'summon-riv', 'pounce', 'sticky-paws', 'lacerate', 'puddle-pounce', 'ember-swipe', 'haste', 'mire', 'wild',
  'cir-hearthflame', 'cir-ember-claws', 'cir-meteor'] as const;

/** Shared reading of the AP model, reused across Insight pages. */
const LINES = 'Under ±1 rules one card rarely fits both foundations (about 0.4 times a turn on this table), so the real choice is which line, which run of cards, you feed to which Kin.';

// Dead-run permutations (019–024): Hero alone on six columns against one
// foe, with the same seed and tuning, so each fix compares like for like.
const BELLOWS_ROOT: TutorialFoeDef = { key: 'bellows-root', name: 'Bellows Khad Root', hp: 16, damage: 1, staggerMax: 6 };
export const DEEP_BREATH: IntentCardDef = { name: 'Deep Breath', pips: 4, maxProgressPerTurn: 1, enemyPlays: 2, passive: 1, damage: 4 };
const deadRun = (id: TutorialScenarioId, name: string, fixes: DeadRunFixes, insight: Omit<TutorialDef['insight'], 'actorId'>): TutorialDef =>
  ({ id, name, seed: 1966, skills: [], columns: 6, party: ['hero'], partyHp: 24, foes: [BELLOWS_ROOT], ...fixes, insight: { actorId: 'hero', ...insight } });
/** Shared Insight lines for the dead-run scenarios. */
const ROOT_LINE = 'The Bellows Khad Root has 16 HP and strikes Hero for 1 each enemy turn; it banks 2 Momentum a turn and spends 4 on a Heavy Strike for 2. Each card Hero receives is a Nip: 1 damage and 1 stagger. Six stagger breaks the gauge, doubles every Nip and makes it spend its next turn recovering.';
const BREATH_LINE = 'Each enemy turn the root plays up to 2 exposed cards that fit Deep Breath (+1 pip each; those columns refill) and adds 1 passive pip. At 4 pips it fires: 4 damage to every Kin, then it returns as a new card with no pips. Each card you play on it removes a pip and earns 1 Momentum, but no AP and no Nip.';
const BREATH_SOLVE = 'Tap or drag a card onto Deep Breath. If a card fits both Hero and the intent, tap it, then pick where it goes. At 2 pips or more it can fire on the root’s next turn (2 plays plus the passive pip), so bring it down to 1 or 0 before you end the turn.';
const BREATH_STAGGER = 'A staggered root skips its whole turn, Deep Breath included: no plays and no passive pip. A break is defence as well as damage.';
const DEAD_RUN_SCENARIOS: readonly TutorialDef[] = [
  deadRun('019', '019: Dead Run', {}, {
    intent: [
      'The control for the dead-run scenarios, 019 to 024. Hero fights alone on six columns, with no intent card, no pity flip and no hold. Every later scenario uses this same deal, foe and tuning, so you can compare the fixes like for like.',
      ROOT_LINE,
    ],
    solve: [
      'With one foundation every card has one place to go, so find the longest run from Hero’s value (±1, A and K wrap) before you play anything.',
      'End Turn keeps the board as it is. Withdraw ends your turn too, and the enemy still acts on the current board, but your next turn opens on the new row you chose. If a turn opens with nothing playable, Withdraw at once: End Turn would leave the same dead board for next time.',
      'End your turn with the root staggered when you can: it spends that turn recovering instead of striking.',
    ],
    why: [
      'The Monte Carlo found that one foundation needs about 14 columns to keep dead deals down; six columns is far below that, at about 38% dead deals even from a fresh deal each turn.',
      'Here the board carries over between turns, so a dead board stays dead until you Withdraw. A simple bot on this table opened more than half its turns with nothing legal and averaged about one card a turn. This scenario lets you feel that before trying the fixes.',
    ],
  }),
  deadRun('020', '020: Deep Breath', { intentCard: DEEP_BREATH }, {
    intent: [
      'The enemy’s intent is a card on the table. Deep Breath sits at the end of the rack as a golf target (±1, A and K wrap), and its 4 pips fill like AP pips.',
      BREATH_LINE,
      'In this version Deep Breath takes the rank of each card played on it, so it is a bridge: a second foundation that you share with the enemy.',
    ],
    solve: [
      BREATH_SOLVE,
      'Use it as a stepping stone. Changing its rank can open the next card for Hero, or leave the root with nothing to play onto it.',
      BREATH_STAGGER,
    ],
    why: [
      'The Monte Carlo found the intent card the strongest of the three fixes because it adds a golf target: on two foundations and seven columns it roughly doubled streaks.',
      'Contesting it matters without making it trivial. Ignored, it fired every 2 to 3 turns; fought, every 4 to 5, at the cost of cards that do not strike. The passive pip is what keeps it firing even when you fight it.',
    ],
  }),
  deadRun('021', '021: Deep Breath, Held Rank', { intentCard: { ...DEEP_BREATH, fixedRank: true } }, {
    intent: [
      'Deep Breath again, but it keeps its rank when cards are played on it. It is a target, not a bridge: the same two ranks always remove a pip, and playing on it never changes what comes next.',
      BREATH_LINE,
    ],
    solve: [
      BREATH_SOLVE,
      'Learn the two ranks that hit it, one above and one below. The root’s plays hunt for those same two ranks, so taking them first both strips pips and starves its plays.',
      'Everything else goes to Hero: the intent no longer opens new lines.',
      BREATH_STAGGER,
    ],
    why: [
      'The Monte Carlo offered a fixed-rank intent as the way to keep today’s pace on seven columns: it stays a target without acting as an extra foundation.',
      'Play it against 020 to feel the difference between a target and a bridge. A simple bot won less often here than in 020, because a fixed intent gave it fewer plays.',
    ],
  }),
  deadRun('022', '022: Deep Breath + Pity Flip', { intentCard: DEEP_BREATH, pityDraw: true }, {
    intent: [
      'Deep Breath plus Hero’s 4 Leaf Clover buff. The buff can flip a stock card onto her foundation. Click it to spend one of three charges; charges do not recharge during combat.',
      'The flip is not a receipt: no Nip, AP or Momentum. It only gives Hero a new value.',
      BREATH_LINE,
    ],
    solve: [
      'If PITY FLIP is lit, nothing is playable: flip first, then look for the run from the new value. If that still fits nothing, Withdraw.',
      'It only checks the start of your turn. Playing into a dead end mid-turn does not light it, so plan the run before you start.',
      BREATH_SOLVE,
    ],
    why: [
      'The Monte Carlo found that one free flip, only when a turn opens dead, cut dead deals from 11% to 4% without lengthening streaks. A flip whenever you are stuck boosts streaks instead, and pricing flips in Momentum runs away because every flip pays for itself.',
      'With one foundation, dead openings are common, so expect to flip on about two turns in three. A simple bot here nearly doubled its cards per turn and almost always won. That frequency is the clearest sign that one foundation on six columns is too tight.',
    ],
  }),
  deadRun('023', '023: Deep Breath + Hold', { intentCard: DEEP_BREATH, holdSlot: true }, {
    intent: [
      'Deep Breath plus a hold slot beside Hero. Drag a card Hero could take right now into Hold to park it. Later, drag or tap it onto Hero or Deep Breath. The slot holds one card, and it waits across turns.',
      'Only a playable card can be parked, and parking is not a receipt: no Nip, AP or Momentum until you play it.',
      BREATH_LINE,
    ],
    solve: [
      'Save the last card of a run instead of playing it. Next turn it opens for you even if the board has gone dead.',
      'Parking takes the card off the table, so the card under it is exposed while Hero keeps her value. Sometimes parking is how you reach the run below.',
      'A parked card can also go onto Deep Breath, so it can strip a pip on the turn that matters.',
      BREATH_SOLVE,
    ],
    why: [
      'The Monte Carlo found the hold a planning tool rather than a dead-deal fix. Alone it moved dead deals only from 11% to 10%, but good players saved a playable card at the end of a turn as insurance for the next.',
      'Only playable cards may be parked. Otherwise a dead card could clog the slot for the rest of the fight.',
    ],
  }),
  deadRun('024', '024: All Three Fixes', { intentCard: DEEP_BREATH, pityDraw: true, holdSlot: true }, {
    intent: [
      'Every dead-run fix at once, at the Monte Carlo’s starting tuning: Deep Breath (4 pips, up to 2 enemy plays and 1 passive pip a turn), 4 Leaf Clover (three manually spent stock flips), and a hold slot.',
      'The Monte Carlo pitched this package for two foundations on six columns (4% dead deals, median streak 11). Here Hero fights alone, so notice how far short of that it falls.',
      BREATH_LINE,
    ],
    solve: [
      'At the start of a turn, flip first if PITY FLIP is lit, then check Hold: a parked card can open the turn.',
      'Bring Deep Breath down to 1 pip or fewer, feed Hero the rest, and end the turn with a playable card parked if you can.',
      BREATH_STAGGER,
    ],
    why: [
      'The fixes cover each other. The pity flip handles dead openings, the hold carries a card across turns, and the intent adds a target along with a reason to spend cards on defence.',
      'If this still feels tight, the problem is the table, not the rules: add a second foundation (Mochi, in Config) or widen the table toward the Monte Carlo’s band.',
    ],
  }),
];

/** teamfourstar (stable ID 1002): four Keru face the Dusk Dragon. */
const ELEMENTAL_SUITS: TutorialDef = { id: '1002', name: '1002: team4star', seed: 1002, randomSeed: true, skills: ['hold', 'summon-riv', 'summon-cir', 'cir-burn', 'cir-flare', 'cir-windstorm', 'swift-wings', 'meteor-launch', 'meteor-impact'], kinRadials: true, columns: 7, party: ['hero', 'dem', 'cir', 'mochi', 'banks'], hideEmptySlot: true, elementSuits: true,
  foes: [{ key: 'dusk-dragon', name: 'Dusk Dragon', hp: 100, damage: 0, staggerMax: 6, noMomentum: true }],
  enemyTurnSeconds: 1,
  intentCard: { name: 'Deep Breath', pips: 4, maxProgressPerTurn: 1, enemyPlays: 2, passive: 0, damage: 55, casterOnly: true, partyPlays: true, readies: true, armored: true },
  strikes: { hero: { name: 'Nip', damage: 1, stagger: 0 }, mochi: { name: 'Scratch', damage: 0, stagger: 1.5 } },
  insight: { actorId: 'hero',
    intent: [
      'Every tableau card has one of six elements: Earth, Air, Fire, Water, Chaos or Nature. The Aldan Seed is the sole friendly tableau foundation, with its own HP, rank and AP. Hero leads from inside the Seed foundation, with Dem, Cir and Mochi supporting. The Seed starts with no affinity. Click the Seed or Hero to access all prepared collected Keru: Cir, Dem and Riv. No pre-battle selection or selected-slot limit. Cir on an enemy casts Burn; on an ally grants 3 AP through Hearthflame. Either costs 0 AP and puts Cir on a three-turn cooldown. Aim at the separate familiar square to attach dormant for 1 Seed AP. Dem/Riv effects are pending.',
      'Play is normal golf: ±1, with A and K wrapping. Matching-element cards may bridge to any rank once per party turn. Cir awakens at 3 pips: any host receipt gives 1, Fire/Air gives 2. Active Cir grants Fire/Air affinity, remaining shield and a Fire receipt bonus. Only the Aldan Seed receives tableau cards. Its destruction ends the expedition even if Keru survive. Ordinary enemy attacks target it; losing a support alone does not end the expedition. Independent Cir foundation progression is deferred.',
      'An element play is a normal receipt: the hit (the provisional Seed pulse chips 1), +1 AP for that Kin and +1 Momentum. A card that is also ±1 legal counts as a normal play and keeps the charge. The charge pip beside End Turn shows whether it is ready, and it resets as each party turn opens.',
      'The current prototype uses the Aldan Seed with Hero leading Dem, Cir and Mochi on 6 columns, 4 deep, with the usual refill, against an endless Training Khad Root. Each start is a fresh deal. The historical two-foundation simulation figures below do not measure this Seed setup.',
    ],
    solve: [
      'Play ±1 first while you can. Attach Cir to the Seed and awaken her with its receipts to gain Fire/Air affinity and remaining temporary HP. Use Burn for damage or Hearthflame for 3 AP, or invest in Cir as a familiar.',
      'Pick the bridge by where it lands. Look at the rank on the element card and at what is exposed one above and one below it; the best element play opens the longest new run, not the first one you see.',
      'The Aldan Seed starts as the only friendly foundation. Click it to open the collected Keru cards. All prepared Keru are available directly in Hero’s hand; Cir retains her release and recovery rules. Chain Seed receipts to chip the root and, once Cir awakens, use Fire/Air to restart a stalled line. Withdraw still ends the turn.',
    ],
    why: [
      'From the suited-cards Monte Carlo (Expert player, 2,000 turns per setting): 6 elements, each Kin taking its own element off-sequence, one such play per turn, on 2 foundations × 5 columns gave 3% dead turns, a median streak of 8, 0% runaway turns and 7.0 usable AP.',
      'Today’s 2 × 7 table with ±1 alone sits at 12% dead turns and a median streak of 5 (5.9 usable AP). The suit rule saves two columns and plays better.',
      'Without the per-turn cap, a matching suit at any rank runs away almost everywhere (95% of turns on 2 × 7 with six suits). The cap makes each element play one bridge rather than a new rule, which is why runaways drop to 0%.',
    ] } };

/** 1006–1009 Keru rarity: the 1005 board, flat 1 AP invokes, feeding for tiers and the notes panel. */
const KERU_RARITY: TutorialDef = { ...ELEMENTAL_SUITS, id: '1007', name: '', seed: 1007, columns: 8, elementSuits: false, party: ['hero'], keru: { rarity: 'rarity', cost: 1 }, notes: true };

export const TUTORIAL_SCENARIOS: readonly TutorialDef[] = [
  { ...ELEMENTAL_SUITS, id: '1004', name: '1004: truefourstar', seed: 1004, columns: 8, elementSuits: false, party: ['hero'] },
  // 1005 Keru Invoke: 1004's board, with Keru cards that swap stored values onto Hero (rules/keruInvoke.ts).
  { ...ELEMENTAL_SUITS, id: '1005', name: '1005: Keru Invoke', seed: 1005, columns: 8, elementSuits: false, party: ['hero'], keru: {} },
  // 1006–1009 Keru rarity: 1005's board and invoke, plus feeding AP into Keru tiers for this battle only.
  { ...KERU_RARITY, id: '1006', name: '1006: Rarity Showcase', seed: 1006, ap: 6, keru: { rarity: 'rarity', cost: 1, refill: true, cast: true }, intentCard: undefined, endless: { hpStep: 0, damageEvery: 0, staggerEvery: 0, staggerCap: 6 },
    foes: [{ key: 'training-dummy', name: 'Training Dummy', hp: 999, damage: 0, staggerMax: 6, noMomentum: true }],
    insight: { actorId: 'hero',
      intent: ['A safe room to see every Keru at every rarity. The Training Dummy never strikes, Hero starts with 6 AP and her AP refills as each turn opens.',
        'Rarity is temporary: it lasts this battle only and Restart resets it. Common is grey, Rare blue, Epic purple with holofoil, Legendary orange-gold with full foil.'],
      solve: ['Feed: drag from Hero’s AP meter and hold over a Keru (in a familiar square, or a card in the open hand). AP pours in about 1 every 0.3s while you hold; release or slide off to stop. Or tap the Keru and use Feed 1 AP / Feed to next tier. 1 AP reaches Rare, 2 more Epic, 3 more Legendary.',
        'Invoke: drag the Keru onto Hero (1 AP). The Keru keeps its tier when swapped off, and feeding the Keru on Hero upgrades her buff at once.',
        'Buffs, Common/Rare/Epic: Dem +4/+8/+12 HP, Banks −2/−4/−8 per hit, Cir +1/+2/+3 chip damage, Mochi +1/+2/+3 stagger, Riv +1 AP every 4/3/2 chip hits. Legendary adds Dem’s Ward, Banks’ halving and reflect, Cir’s burn, Mochi’s armor-piercing stagger and Riv’s +1 AP cap.',
        'Cast (once per Keru, free): drag the small gem in a Keru card’s or square’s corner onto a target, or tap the Keru and choose Cast. n = tier number (Common 1 … Legendary 4): Riv Surge +2n AP and Dem Mend heals 6n on an ally; Cir Flare 6n fire, Mochi Pounce 3n stagger (Legendary through the armor) and Banks Hex Weakened for n enemy turns (half damage) on an enemy. Casting exhausts the Keru: its card is tapped for the rest of the battle (no invoke, feed or cast), and one on Hero leaves her with no farewell.'],
      why: ['The visual and rules check for rarity. Nothing here is a threat, so every tier and its effect can be seen and read in one battle.'] } },
  { ...KERU_RARITY, id: '1007', name: '1007: Opening Pull', seed: 1007, ap: 3,
    insight: { actorId: 'hero',
      intent: ['The Dusk Dragon fight with 3 discretionary Hero AP at the start. Every invoke costs 1 AP and every feed costs 1 AP, so the opening is a spending choice.'],
      solve: ['Medium pull: invoke one Keru and feed it 2 AP to Rare (Banks or Dem to brace, Cir to chip). One strong buff for the long fight.',
        'Light pulls: invoke one Common Keru now, bank the rest, and swap to another later as the board changes. Cheaper now, more flexible later.',
        'Either way, AP keeps coming from receipts: a Keru you fed stays at its tier when swapped off, so investment is never lost this battle.'],
      why: ['Tests whether one deep investment or two shallow ones reads as the better opening when the cost of both is visible up front.'] } },
  { ...KERU_RARITY, id: '1008', name: '1008: Brace for Deep Breath', seed: 1008, ap: 2, breathStart: 4,
    insight: { actorId: 'hero',
      intent: ['Deep Breath is already fully charged. Unless you pull pips off it, the dragon readies, inhales and breathes 55 on Hero on its third enemy turn. Hero has 32 HP.'],
      solve: ['Feed Dem to Legendary (invoke 1 + feed 6) and have Dem on Hero when it lands: the Ward absorbs the whole breath.',
        'Or feed Banks to Legendary: it halves the breath and takes 8 more (55 → 20) and reflects a quarter of what it stops back at the dragon.',
        'Epic is not enough alone (Dem gives 40 HP, Banks still takes 47). Pair an Epic with pip removal: every pip you take off the breath shrinks its damage and delays it.'],
      why: ['Checks that the defensive Keru each have a tier where they answer the boss attack, and that the AP for it is reachable in three turns.'] } },
  { ...KERU_RARITY, id: '1009', name: '1009: Break the Dragon', seed: 1009, ap: 4, breathStart: 0,
    insight: { actorId: 'hero',
      intent: ['The Dusk Dragon starts charging Deep Breath. While it charges, the dragon cannot be staggered, unless Hero carries a Legendary Mochi.'],
      solve: ['Invoke Mochi (1 AP) and feed it to Legendary (6 AP). Hero starts with 4, so it takes about two turns of receipts.',
        'Legendary Mochi adds 3 stagger to each Nip and ignores Duskscale Armor and Deep Breath: two receipts break the dragon’s gauge mid-charge, the breath backfires on it and it is stunned at stage III.',
        'Watch the pips: it charges one per turn. Pull pips off the breath to buy time if the AP is slow.'],
      why: ['The intended boss answer for rarity: a Legendary utility effect that changes what is possible, not just a bigger number. Tight but reachable AP.'] } },
  // 1010 AP Engine: a three-slot harness of AP-engine Keru against the Vault Warden's sealed core (rules/keruInvoke.ts).
  { ...KERU_RARITY, id: '1010', name: '1010: AP Engine', seed: 1010, ap: 3, intentCard: undefined, keru: { rarity: 'engine', cost: 1, slots: 3, seal: 12 },
    foes: [{ key: 'vault-warden', name: 'Vault Warden', hp: 30, damage: 2, staggerMax: 6, noMomentum: true }],
    insight: { actorId: 'hero',
      intent: ['The Vault Warden, a brass-and-stone construct. Sealed Core: it takes no chip damage until Hero pours 12 AP into the seal in ONE party turn. A short pour is lost when the turn ends.',
        'Tithe: after each of its turns it drains 2 of Hero’s AP, and its strike grows by 1 every turn. Banking AP slowly loses.',
        'Scenario rule, Harness: Hero holds up to three invoked Keru at once (the slots on her card). Invoking into a full harness replaces the oldest. Hero’s value still swaps with the Keru just invoked.'],
      solve: ['Build the engine over three or four turns, feeding as you go: Banks (Capacitor) for AP cap +2/+4/+6/+8, Riv (Generator) for +1 AP every 4/3/2/1 chip hits, Cir (Multiplier) for ×2 AP per received card from Epic, plus a 1 AP refund per 4 poured at Legendary.',
        'Pour: drag from Hero’s AP meter and hold over the Warden: AP pours in about 1 every 0.3s (or use Pour 1 AP on its seal meter). Pour as you earn during the big turn; reach 12 before ending it.',
        'A broken seal stuns the Warden for 2 turns with double chip damage. It then reseals 4 higher (16, then 20). Dem and Mochi keep their defensive buffs if the Tithe ramp gets close.'],
      why: ['Counters slow, defensive play: the cap of 6 and the Tithe make 12 in one turn out of reach without stacking cap, generation and a multiplier. It tests whether a Keru configuration reads as a build.'] } },
  // PARKED (Eric, 2026-10-28): 1011 Keru Stack is out of the scenario list; its definition is kept here, commented out.
  // // 1011 Keru Stack: the Dusk Dragon with Hero stacking rarity Keru within her load budget, and pair synergies.
  // { ...KERU_RARITY, id: '1011', name: '1011: Keru Stack', seed: 1011, ap: 3, keru: { rarity: 'rarity', load: 6 },
  //   insight: { actorId: 'hero',
  //     intent: ['The Dusk Dragon, with Hero carrying several Keru at once. Each uses load equal to its rarity (Common 1, Rare 2, Epic 3, Legendary 4); her capacity is 6, shown as the pips beside her Keru badges. Their buffs stack, and Hero’s value swaps with the Keru just invoked.',
  //       'Mounting cost: invoking costs 1 AP for her first Keru, 2 for the second, 3 for the third. Drop a Keru onto one of her badges to replace that Keru instead (its load and buff leave), costing as if it were already gone. An invoke or feed that would pass 6 load is blocked and says how much load it needs.'],
  //     solve: ['Synergies, while both are on Hero (a glowing link and a named chip): Feedback, Riv + Cir: each AP Riv generates adds +1 chip damage to the next hit. Fortress, Dem + Banks: a 1-hit Ward absorbing up to 10 refreshes each turn (Legendary Dem: the whole hit). Shatter, Mochi + Cir: a stagger break deals 5 × Mochi’s tier number (Common 1 … Legendary 4).',
  //       'Brace build (load 6): Legendary Dem + Rare Banks. Fortress makes Dem’s Ward refresh every turn, so the 55 breath is absorbed whenever it lands.',
  //       'Steady build (load 5): Rare Banks + Rare Dem + Common Mochi. Fortress soaks up to 10 of each turn’s first hit after Banks’ 4 and Mochi adds stagger; against the 55 breath it still needs pip removal, since a Legendary Dem beside Banks and Mochi would need load 7.',
  //       'Break build (load 6): Legendary Mochi + Rare Cir. Mochi’s stagger goes through the armor and Deep Breath, Cir adds 2 chip damage, and Shatter adds 20 on every break.',
  //       'Engine build (load 5): Epic Riv + Common Cir + Common Mochi. Feedback turns Riv’s AP into extra chip damage, and Shatter adds 5 on each break.'],
  //     why: ['Tests whether stacking Keru reads as a build: a fixed load budget makes depth (one Legendary) and breadth (three Commons and a synergy) compete, while the rising invoke cost keeps a third Keru a real decision.'] } },
  // 1012 Keru Upkeep: no load cap; every Keru on Hero costs upkeep each turn and leaves a farewell when dismissed (rules/keruInvoke.ts).
  { ...KERU_RARITY, id: '1012', name: '1012: Keru Upkeep', seed: 1012, ap: 0, keru: { rarity: 'upkeep', cost: 1, upkeep: true, cast: true },
    insight: { actorId: 'hero',
      intent: ['The Dusk Dragon (100 HP; Deep Breath for 55 against Hero’s 32 HP). Any number of Keru can be on Hero, but each costs upkeep at the END of every party turn equal to its tier number: Common 1, Rare 2, Epic 3, Legendary 4. Hero’s card shows the total beside her AP; each familiar has its own foundation and buff beneath it.',
        'Upkeep is paid oldest first. A Keru Hero can’t pay is dismissed (starved). You can also dismiss one yourself, free, by dragging its portrait away or opening its card and choosing Dismiss. It returns to the hand with its tier and value, and costs 1 AP to invoke again, but only after a cooldown: a dismissed Keru (on purpose or starved) sits out the rest of that turn and the next 2 party turns (its card shows ⏳ and the turns left). You can still feed it while it waits.',
        'Farewell, on every dismissal, on purpose or starved (n = tier number): Dem heals 3n and leaves a Ward for the next hit (2 enemy turns); Banks halves incoming damage (2 enemy turns); Cir bolts the dragon for 4n fire; Mochi adds 2n stagger (Legendary through Duskscale Armor and Deep Breath); Riv refunds n + 1 AP.'],
      solve: ['On Hero: Banks is a Capacitor, AP cap +3/+6/+9/+12; Riv is a Generator, +1 AP every 3/2/1 chip hits, and a Legendary Riv also banks +1 AP per stagger break. Dem, Cir and Mochi keep their rarity buffs (HP, chip damage, stagger). Invoking costs a flat 1 AP. Drag a hand card onto Hero to familiarize it. Feed by dragging from Hero’s AP meter and holding over a familiar portrait or hand card (about 1 AP every 0.3s), or tap the Keru for Feed 1 AP / Feed to next tier.',
        'Machine: feed Banks and Riv until Riv’s receipts pay the whole upkeep, then keep Cir and Mochi on for steady chip damage and stagger. Slow to start and every new Keru raises the bill.',
        'Burst: spend big for one turn (invoke several, feed one high), then let them starve or dismiss them right before Deep Breath lands to chain farewells: Banks halves the breath, Dem’s Ward absorbs it, Cir’s bolt and a Legendary Mochi’s stagger break it mid-charge for the backfire. Strong once, then Hero is back to a bare hand.',
        'Cast (once per Keru, free; its jumbo ladder lists each tier): open the Keru card, choose Cast, then select a target. Surge +2n AP or Mend 6n HP on an ally; Flare 6n fire, Pounce 3n stagger (Legendary through the armor) or Hex Weakened n enemy turns (half damage) on the dragon. The Keru is then discarded for the battle. Casting one off Hero skips its farewell and cooldown, so a cast is a third way to spend a Keru: instead of keeping it or cashing its farewell.'],
      why: ['Tests a bigger AP pool balanced by upkeep instead of a load cap: a sustained Keru machine versus a brief overload that cashes out in farewells. Tuning is provisional and not yet simulated.'] } },
  { id: '008', name: '008: Chip Tutorial', seed: 608, skills: [],
    foes: [{ key: 'training-root', name: 'Training Khad Root', hp: 6, damage: 2, staggerMax: 6 }],
    endless: { hpStep: 2, damageEvery: 3, staggerEvery: 2, staggerCap: 10 },
    strikes: { hero: { name: 'Nip', damage: 1, stagger: 0 }, mochi: { name: 'Scratch', damage: 0, stagger: 1.5 } },
    insight: { actorId: 'hero',
      intent: [
        'Learn the two jobs a tableau card can do in a fight: chip HP or build stagger. There are no ability cards here, only the hit each foundation makes when it receives a card.',
        'Hero’s Nip deals 1 damage and no stagger. Mochi’s Scratch deals no damage but adds 1.5 stagger. Each Khad Root you fell is one round, and a tougher one roots in at once: more HP every round, a bigger gauge every second round, a harder strike every third.',
        'Every card a foundation receives also banks 1 AP for that Kin (up to 6) and 1 shared Momentum. You can’t spend AP here, but watch it build: later scenarios spend it on each Kin’s own abilities.',
      ],
      solve: [
        `Route by role. ${LINES} Feed Mochi a line until the gauge breaks (four Scratches fill a 6-point gauge), then feed Hero everything you can: while staggered, every Nip deals ×2.`,
        'Keep Scratching after the break. Filling the gauge again raises the stagger stage to II (×3) and then III (×4), so a long Mochi run followed by a long Hero run is worth far more than alternating.',
        'A staggered root spends its next enemy turn recovering instead of striking. If you can’t finish it this turn, end your turn with it staggered.',
        'Read the buried cards before you start. Find the longest run, then decide which foundation it lands on: a dead end for one Kin is often the next step for the other.',
        'The root banks 2 Momentum each turn and spends 4 on a Heavy Strike for double damage, so every second strike hurts. No moves left? Withdraw ends your turn: the root acts on the current board, and your next turn opens on the redealt tableau.',
      ],
      why: [
        'Golf solitaire asks one question: can I play this card? Combat adds a second: who should receive it? The same run is weak or devastating depending on where it lands.',
        'Stagger rewards commitment. Half a gauge does nothing; a full one doubles your damage and cancels the enemy’s turn. That all-or-nothing risk is the heartbeat of every later scenario.',
        'Endless rounds with rising HP, gauges and damage give you a score to beat and make every wasted card visible.',
      ] } },
  { id: '009', name: '009: Ability Playground', seed: 1509, skills: ALL_SKILLS, partyHp: 40, ap: 6, momentum: 30, decay: false,
    foes: [
      { key: 'sparring-root', name: 'Sparring Root', hp: 30, damage: 1, staggerMax: 6 },
      { key: 'sap-root', name: 'Sap Root', hp: 30, damage: 1, staggerMax: 6, inflicts: 'sap' },
      { key: 'hush-root', name: 'Hush Root', hp: 30, damage: 1, staggerMax: 6, inflicts: 'silence' },
    ],
    endless: { hpStep: 0, damageEvery: 0, staggerEvery: 0, staggerCap: 6 },
    insight: { actorId: 'mochi',
      intent: [
        'A sandbox with every ability, Keru and status card. Kin have 40 HP and start with full AP (6 each), and Momentum decay is off, so nothing punishes experimenting.',
        'The roots strike for 1, so you can watch every status work: the Sap Root Saps the Kin it hits and the Hush Root Silences its target. Each root is replaced the moment it falls.',
      ],
      solve: [
        'Tap a foundation to open that Kin’s abilities; tap the other foundation to show both hands at once, and tap a foundation again to put its hand away. Each card costs its owner’s AP, shown on the foundation. The Momentum dial holds only Withdraw.',
        'Hold a card to drag it onto a target. Big hands page by Attacks and Support.',
        'Try the reactions: Puddle Pounce then Frost Fang (instant Freeze), then Takedown (Shatter). Soak all three roots and Thunder Bark one. Lacerate, play a long run, then Ember Swipe to Cauterize. Send Hero into Ember Rage before a long Hero line.',
        'Each card a foundation receives refills 1 AP for that Kin, up to 6. Turn Momentum decay back on in Config when you want pressure.',
      ],
      why: [
        'Statuses matter in combination. This is where you find combos no scenario has been written for yet, and where broken ones show up first.',
        'Every reaction is still a tableau decision: which Kin’s line you play, and in what order you cast. Playing here builds the instincts the focused scenarios test.',
      ] } },
  { id: '010', name: '010: Tempo', seed: 1310, skills: ['haste', 'mire', 'pounce'],
    foes: [{ key: 'sap-root', name: 'Sap Root', hp: 16, damage: 2, staggerMax: 6, inflicts: 'sap', statuses: [{ id: 'haste', turns: 3 }] }],
    insight: { actorId: 'mochi',
      intent: [
        'Haste against Slow, on both sides. Your Kin bank AP per card received; an enemy banks 2 Momentum on each of its turns and spends 4 on a Heavy Strike (double damage).',
        'Your Haste doubles both AP and Momentum on a Kin’s next 4 cards. Enemy Haste doubles its Momentum; Slow halves it, rounded down. The Sap Root opens Hasted for 3 turns, banking 4 a turn: a Heavy Strike every turn. Its hit also Saps a Kin for two of your turns, so that foundation can’t receive two cards in a row.',
      ],
      solve: [
        'All three cards are Mochi’s: Mire (2 AP), Haste (2 AP) and Pounce (3 AP), so Mochi’s line matters most this fight.',
        'Cast Mire on the root early. Slowed, its gain drops to 2 while Hasted (1 once Haste ends), so Heavy Strikes come every other turn or less.',
        'Haste the Kin that is not Sapped, then feed it your next 4 cards. Haste on Mochi refills her AP for Pounce twice as fast.',
        'A Sapped Kin must alternate, so plan zig-zag lines that end on the Hasted foundation. Pounce once the gauge breaks: 6 damage to a staggered root.',
      ],
      why: [
        `Tempo becomes a resource both sides spend. ${LINES} Haste rewards a long line on one foundation; Sap forbids exactly that.`,
        'Mire turns the enemy’s Heavy Strikes back into ordinary ones, and shows Slow and Haste as two sides of the same currency.',
      ] } },
  { id: '011', name: '011: Frost & Shatter', seed: 511, skills: ['frost-fang', 'takedown', 'puddle-pounce'],
    foes: [{ key: 'frostbound-root', name: 'Frostbound Khad Root', hp: 24, damage: 4, staggerMax: 8 }],
    insight: { actorId: 'hero',
      intent: [
        'A heavy hitter (4 damage) with a big 8-point stagger gauge. Learn Chill, Freeze and Shatter: control the root first, then break it in one blow.',
      ],
      solve: [
        'The combo is mostly Hero’s: Frost Fang (2 AP) and Takedown (3 AP) need 5 Hero AP, so feed Hero a long line before you cast. Mochi’s Puddle Pounce costs just 1 AP.',
        'Frost Fang deals 1 damage, adds 1 Chill and gives Rime: each of Hero’s tableau hits this turn adds Chill, so two more cards to Hero reach 3 Chill and Freeze it.',
        'Faster route: Puddle Pounce first. Any Chill on a Soaked root Freezes it instantly.',
        'A Frozen root skips its next turn. Takedown on a Frozen root Shatters it: double damage and a full stagger gauge, which breaks it on the spot. Then chip: while staggered, tableau hits deal ×2.',
      ],
      why: [
        'Freeze-then-Shatter is a two-step combo whose order matters: a Takedown before the Freeze wastes the Shatter. It rewards feeding Hero one long line, then routing more cards to her after casting Rime.',
        'Each Chill also costs the root 1 Momentum gain per turn, so even partial Chill delays its Heavy Strike.',
      ] } },
  { id: '012', name: '012: Storm', seed: 612, skills: ['puddle-pounce', 'thunder-bark'],
    foes: [
      { key: 'bramble-rootling', name: 'Bramble Rootling', hp: 8, damage: 1, staggerMax: 6 },
      { key: 'thorn-rootling', name: 'Thorn Rootling', hp: 8, damage: 1, staggerMax: 6 },
      { key: 'briar-rootling', name: 'Briar Rootling', hp: 8, damage: 1, staggerMax: 6 },
    ],
    insight: { actorId: 'hero',
      intent: [
        'Three rootlings each strike for 1 every enemy turn. One shock can hit all of them, but only if they’re Soaked.',
      ],
      solve: [
        'Mochi soaks (Puddle Pounce, 1 AP each) and Hero shocks (Thunder Bark, 2 AP), so you need a line for each Kin: three cards to Mochi, two to Hero.',
        'Soaked lasts 2 enemy turns, so you can spread the soaking across two of your turns while Mochi’s AP refills.',
        'Thunder Bark any Soaked rootling: its 2 shock damage Conducts to every other Soaked rootling. Drag a foundation onto a rootling to change who its tableau hits strike.',
      ],
      why: [
        'Area effects need setup from two Kin. Splitting the tableau between a soaking line and a shocking line, and deciding when the setup is enough, is a routing puzzle that rewards reading the whole board.',
      ] } },
  { id: '013', name: '013: Steam', seed: 613, skills: ['puddle-pounce', 'ember-swipe'],
    foes: [{ key: 'thornlash-root', name: 'Thornlash Root', hp: 18, damage: 4, staggerMax: 6 }],
    insight: { actorId: 'mochi',
      intent: [
        'Soak plus fire makes Steam, which Blinds instead of burning. The Thornlash Root hits for 4, so its next strike matters.',
      ],
      solve: [
        'Both cards are Mochi’s: Puddle Pounce (1 AP) then Ember Swipe (2 AP). Feed Mochi a 3-card line before you end the turn.',
        'Steam Blinds the root: its next strike misses half the time. Blind is spent on that strike, so Steam right before you end the turn.',
        'Without Soak, Ember Swipe sets Burn instead: 2 damage at the start of each of the next 2 enemy turns. More damage, no defence.',
      ],
      why: [
        'The same fire card is offence or defence depending on what you did first. Taking guaranteed burn damage or a coin-flip dodge against a big hit is a real risk/reward call, paid for by one Kin’s line.',
      ] } },
  { id: '014', name: '014: Bleed then Burn', seed: 314, skills: ['bite', 'lacerate', 'ember-swipe'],
    foes: [{ key: 'bramble-root', name: 'Bramble Khad Root', hp: 22, damage: 2, staggerMax: 6 }],
    insight: { actorId: 'mochi',
      intent: [
        'Learn the order of damage over time: bleed first, burn last. Fire on a Bleeding root Cauterizes it: the remaining Bleed lands at once, but the wound seals and no Burn is set.',
      ],
      solve: [
        'Hero Bites to Expose it (2 Hero AP): every tableau hit on it adds 1 Bleed. Mochi Lacerates for +4 Bleed (3 Mochi AP).',
        'Every card any Kin plays makes it bleed 1, so a long run drains the stack while Exposed keeps refilling it, and each card refills AP for the next cast.',
        'When the Bleed runs dry, Ember Swipe (2 Mochi AP) to set Burn for the enemy turns. Cauterize only when you need the burst now, for example to finish it before it strikes.',
      ],
      why: [
        'Bleed is fuelled by playing cards; Burn is fuelled by passing turns. Knowing which clock each status runs on, and that they cancel, turns status order into a puzzle.',
      ] } },
  { id: '015', name: '015: Silence & Banking', seed: 215, skills: ['bash', 'pounce', 'guard'],
    foes: [{ key: 'hush-root', name: 'Hush Root', hp: 20, damage: 2, staggerMax: 6, inflicts: 'silence' }],
    insight: { actorId: 'hero',
      intent: [
        'The Hush Root Silences the Kin it strikes for your next turn: that Kin can’t use abilities, but cards it receives still bank its AP (up to 6) for later.',
      ],
      solve: [
        'Feed the Silenced Kin a line anyway: its AP waits for the turn after. Spend with the free Kin: Hero’s Bash costs 1 AP, Mochi’s Pounce 3.',
        'Pounce deals 6 to a staggered target. Break the gauge (tableau hits plus Bash) in the same turn you Pounce, because a staggered root recovers on its own turn.',
        'Guard (2 Hero AP) absorbs a hit along with its Silence. Guard the Kin whose abilities you need next turn.',
        'It strikes the Kin holding the most AP, so spending AP is also how you steer who gets Silenced.',
      ],
      why: [
        'Silence separates earning from spending. Because AP persists between turns (up to the cap), banking through a Silenced Kin is a real plan, and the cap stops it becoming free.',
      ] } },
  { id: '016', name: '016: Haste + Vice Grip', seed: 816, skills: ['haste', 'vice-grip', 'pounce'],
    foes: [{ key: 'bramble-brute', name: 'Bramble Brute', hp: 30, damage: 4, staggerMax: 6 }],
    insight: { actorId: 'hero',
      intent: [
        'The Bramble Brute hits for 4 and has 30 HP. Vice Grip commits all of Hero’s AP to hold it 1 enemy turn per 2 AP. Haste makes a foundation’s next 4 cards earn double AP. Together they lock it down.',
      ],
      solve: [
        'Mochi casts Haste on Hero (2 Mochi AP). Feed Hero your next line: 3 cards fill her to the 6 AP cap.',
        'Then Vice Grip with everything: 6 AP holds the brute for 3 enemy turns, during which it can’t strike or bank Momentum.',
        'While it’s held, chip freely and refill. Mochi’s Pounce (3 AP) doesn’t release the hold; another Hero ability would.',
      ],
      why: [
        'A true synergy across two Kin: Mochi’s Haste turns Hero’s line into AP, Hero’s Vice Grip turns AP into turns. Spending everything makes committing feel weighty.',
      ] } },
  { id: '017', name: '017: Ember Rage', seed: 917, skills: ['ember-rage', 'bash', 'pounce'],
    foes: [{ key: 'tinder-khad', name: 'Tinder Khad', hp: 100, damage: 3, staggerMax: 6,
      statuses: [{ id: 'dormant', turns: 1 }, { id: 'regrowth', stacks: 40 }, { id: 'heavy-bark' }, { id: 'dry-bark' }, { id: 'stifling-sap' }] }],
    // Hero (2) has a ten-card climb 3…Q down columns 1–3; Mochi (5) has a four-card descent 4…A in column 4.
    deal: [[13, 5, 4, 3], [12, 8, 7, 6], [12, 11, 10, 9], [1, 2, 3, 4], [13, 13, 13, 13], [13, 13, 13, 13], [9, 13, 13, 13]],
    insight: { actorId: 'hero',
      intent: [
        'Ember Rage is Hero’s 0-AP rage for one turn. While she rages she can’t use any other ability: she only chip-hits, and every chip hit deals bonus fire equal to her AP ÷ 3 (rounded down, counted after that card’s AP). Her AP cap rises from 6 to 12; when the turn ends the rage fades and AP above 6 burns off.',
        'The Tinder Khad is built to demand it. Regrowth: at the end of each of its turns it heals to full unless it is below 40% HP, so you must take it from 100 to under 40 in a single turn. Heavy Bark halves any physical hit of 3 or more; Dry Bark doubles fire. Stifling Sap lets your whole party play only one ability per turn (Withdraw is exempt). It is dormant on its first turn and has no Thorns.',
      ],
      solve: [
        `Read the board before you rage. ${LINES} Here Hero has a ten-card climb (3 up to Q down the first three columns) and Mochi has a short descent (4 down to A).`,
        'Spend your one ability slot on Ember Rage, then feed Hero the whole climb. At 3 AP each hit gains +1 fire, at 6 AP +2, at 9 AP +3, and Dry Bark doubles every point: the full climb takes it from 100 to about 36.',
        'The same climb without the rage only reaches about 86, and a Pounce is halved by Heavy Bark, so either way it regrows. Big single hits are exactly what this bark ignores.',
        'Mochi’s descent still helps: her Claws add stagger, and a staggered Khad takes double from every fiery hit. Play the 4 to Mochi first if you want the break sooner, but don’t take Hero’s 3 or 6.',
        'You have a free first turn while it sleeps: bank AP and Momentum, or use it to set up Mochi’s line.',
      ],
      why: [
        'Stifling Sap makes the one-ability slot precious, and the best use of a single cast is the one that empowers many basic hits. Heavy Bark punishes big single hits; Dry Bark rewards fire. Together they make the rage the obvious answer, once you see the long line.',
        'It is a rage trade-off: dead weight on a short turn and a huge swing on a long chain. The cost is control: Hero gives up every other ability, the cards she eats can’t go to Mochi, and AP past 6 burns off at the handoff.',
      ] } },
  { id: '018', name: '018: Focus Fire', seed: 1018, skills: ['focus-fire', 'bash', 'pounce'], ap: 2,
    foes: [{ key: 'briar-wall', name: 'Briar Wall Root', hp: 20, damage: 2, staggerMax: 6 }],
    // Kings cap every long line: Hero's climbs 3–5, 6–8 and 9–J and Mochi's descent 4–2 all sit under one.
    deal: [[5, 4, 3, 13], [8, 7, 6, 13], [11, 10, 9, 13], [2, 3, 4, 13], [10, 10, 9, 9], [10, 9, 10, 9], [9, 10, 9, 10]],
    insight: { actorId: 'hero',
      intent: [
        'Focus Fire (2 Hero AP): pick any tableau card and every card of that rank burns away, buried or exposed, and the columns refill. Each burned card deals 1 fire to every foe. Burned cards aren’t receipts: no chip hits, AP or Momentum.',
        'This deal is locked: a King sits on top of every long line, and nothing exposed fits Hero (2) or Mochi (5).',
      ],
      solve: [
        'Hero starts with 2 AP. Drag Focus Fire onto any King (or tap the card, then a King). All four Kings light up before you commit, then burn: 4 fire damage to the root.',
        'Underneath are Hero’s climb 3–4–5, 6–7–8, 9–10–J and Mochi’s descent 4–3–2. Feed Hero the climb across the three columns, then Mochi the descent.',
        `${LINES} Burning the right rank decides which lines exist at all.`,
        'Without Focus Fire your only move is Withdraw, which hands the root a turn on this board before your redeal arrives.',
      ],
      why: [
        'Most abilities change the fight; Focus Fire changes the board. It teaches that the tableau itself is a target: one rank can be the wall between you and a ten-card turn.',
        'It costs AP that Hero could spend on Bash, and the cards it burns earn nothing, so it is only worth it when the run it opens is longer than the cards it removes.',
      ] } },
  ...DEAD_RUN_SCENARIOS,
  ELEMENTAL_SUITS,
  { id: '1000', name: '1000: Dusk Dragon', seed: 1000, randomSeed: true, skills: ['hold', 'summon-riv'], kinRadials: true, hideEmptySlot: true, columns: 6, party: ['hero'], partyHp: 99, enemyTurnSeconds: 1,
    foes: [{ key: 'dusk-dragon', name: 'Dusk Dragon', hp: 100, damage: 0, staggerMax: 6, noMomentum: true }],
    // Caster-built and readying: only the dragon adds cards (at random among the matches, no passive pip). It casts from
    // behind Duskscale Armor, and at full charge the breath becomes a readied card: a skipped turn, then 55 to every Kin.
    intentCard: { name: 'Deep Breath', pips: 4, maxProgressPerTurn: 1, enemyPlays: 2, passive: 0, damage: 55, casterOnly: true, partyPlays: true, readies: true, armored: true }, pityDraw: true,
    insight: { actorId: 'hero',
      intent: [
        'A boss fight against one ability. The Dusk Dragon has 100 HP and no basic attack. Hero starts with 99 HP and six three-card columns. Only exposed cards are playable. Every tableau card offers two diagonal alternative values, excluding duplicates and adjacent pairs (including A/K). One legal result plays automatically; multiple foundations or two legal resulting values prompt a choice. Each card grants one receipt. Fresh random deals on start and restart.',
        'The dragon opens behind Duskscale Armor: your hits can’t build its stagger. On its first turn it casts Deep Breath, which spins out beside it, sheds the armor and becomes the dragon’s own foundation. Only the dragon adds cards to it: each enemy turn it plays up to 2 matching exposed cards, using either value, picked at random, and each is a pip.',
        'At 4 pips Deep Breath is fully charged and becomes a readied card in the dragon’s hand. Like a card that can’t be used the turn it arrives, it waits: the dragon skips its next turn to inhale, then breathes 55 damage on every Kin on the turn after, and re-arms.',
        'Also on: Hero’s 4 Leaf Clover buff (three stock flips, no recharge), the delayed-redeal Withdraw and Hero’s Summon: Dem card (6 AP), which brings Dem in with their own Ace foundation. The enemy turn plays out one action at a time.',
      ],
      solve: [
        'Break it: from the moment it casts until the breath lands, the dragon has no armor. Fill its stagger gauge (6) with Hero’s Nips and Deep Breath backfires: its 55 damage hits the dragon instead, the stagger jumps to stage III (every Nip deals ×4) and the dragon is stunned for two enemy turns. That is your run to finish it. If it survives, it recovers, re-arms and casts again.',
        'Starve it: you can’t play onto Deep Breath, but every exposed card one rank from its value is a card the dragon might take. Play exposed cards to Hero, Dem or Riv to deny them to the dragon. A played split card uses only its selected value and leaves the other behind; the next buried card becomes exposed. It picks at random, so the board doesn’t mark which.',
        'Count the window: cast and 2 cards on its first turn, 4 pips the next, then a skipped turn. That is three of your turns to break it, more if you starve it.',
        '4 Leaf Clover, Summon: Dem and Withdraw help you keep a long Hero run going when the board dries up.',
      ],
      why: [
        'This tries two templates for abilities. First, an ability is a foundation only its caster builds, so the other side’s counterplay is denial and reading the risky cards, not markers.',
        'Second, an ability that needs a waiting turn after charging becomes a readied card with a delay, which gives the other side a visible window. Here the window is a stagger race: the armor makes breaking the only answer, and only while it charges.',
        'Player abilities that build foundations will mirror both. The break is the defining victory mechanic: a breath that lands costs you 55 of Hero’s 99 HP, so you have one miss to spare.',
      ] } },
];

export const tutorialById = (id: string | undefined): TutorialDef | undefined => id === '102' || id === '104' || id === '105' ? { ...tutorialById('100')!, id, name: id === '102' ? '102: Frost Sentry' : id === '104' ? '104: Rime Pair' : '105: Frost Warden', seed: Number(id), foes: id === '102' ? [{ key:'frost-sentry', name:'Frost Sentry', hp:14, damage:0, staggerMax:6, noMomentum:true, frostKit:'armor' }] : id === '104' ? [{ key:'rime-guard', name:'Rime Guard', hp:14, damage:0, staggerMax:6, noMomentum:true, frostKit:'retort' }, { key:'snow-wisp', name:'Snow Wisp', hp:10, damage:0, staggerMax:6, noMomentum:true, frostKit:'whiteout' }] : [{ key:'frost-warden', name:'Frost Warden', hp:24, damage:0, staggerMax:8, noMomentum:true, frostKit:'armor' }, { key:'rime-wisp', name:'Rime Wisp', hp:10, damage:0, staggerMax:6, noMomentum:true, frostKit:'retort' }], insight: { actorId:'hero', intent:['Frost enemies play adjacent cards for chip damage. Their weakened Ice Armor, Rime Retort and Whiteout mirror rewards available to Hero.'], solve:['Inspect each enemy buff and choose your target carefully.'], why:['A small frost encounter with readable counterplay.'] } } : id === '103' ? { ...tutorialById('101')!, id: '103', name: '103: Three Motes', seed: 103, foes: [...tutorialById('101')!.foes, { key: 'mote-of-darkness-3', name: 'Mote of Darkness', hp: 10, damage: 0, staggerMax: 6, noMomentum: true }], insight: { actorId: 'hero', intent: ['Three Motes of Darkness have 10 HP each and no abilities. Each plays adjacent cards onto its own foundation and deals 1 chip damage per card.'], solve: ['Play cards onto Hero and choose which Mote to target.'], why: ['A three-enemy encounter with separate tableau values.'] } } : id === '101' ? { ...tutorialById('100')!, id: '101', name: '101: Two Motes', seed: 101, foes: [{ key: 'mote-of-darkness', name: 'Mote of Darkness', hp: 10, damage: 0, staggerMax: 6, noMomentum: true }, { key: 'mote-of-darkness-2', name: 'Mote of Darkness', hp: 10, damage: 0, staggerMax: 6, noMomentum: true }], insight: { actorId: 'hero', intent: ['Two Motes of Darkness have 10 HP each and no abilities. Each plays adjacent cards onto its own foundation and deals 1 chip damage per card.'], solve: ['Play cards onto Hero and choose which Mote to target.'], why: ['A two-enemy encounter with separate tableau values.'] } } : id === '100' ? { ...TUTORIAL_SCENARIOS.find(def => def.id === '1012')!, id: '100', name: '100: Mote of Darkness', seed: 100, intentCard: undefined, foes: [{ key: 'mote-of-darkness', name: 'Mote of Darkness', hp: 10, damage: 0, staggerMax: 6, noMomentum: true }], insight: { actorId: 'hero', intent: ['The Mote of Darkness has 10 HP and no abilities. It plays adjacent tableau cards onto its foundation, dealing 1 chip damage per card to Hero.'], solve: ['Play adjacent cards onto Hero to attack and earn AP. Hero can familiarize and feed Keru as in 1012.'], why: ['A small encounter for testing Hero and her familiars.'] } } : id === '111' ? { ...TUTORIAL_SCENARIOS.find(def => def.id === '1012')!, id: '111', name: '111: partycomp', seed: 111, columns: 5, partyHp: 32, party: ['dem', 'hero', 'banks'] } : id === '1001' ? { ...TUTORIAL_SCENARIOS.find(def => def.id === '1000')!, id: '1001', name: '1001: Layout Laboratory', seed: 1001, randomSeed: false, deal: [[8,11,3],[12,1,7],[4,13,9],[10,7,12],[11,3,4],[13,10,5]], insight: { actorId: 'hero', intent: ['Compare six playable interpretations of one opening deal. Tabs reset the encounter, cards and resources so each comparison starts from the same state.', 'Every layout starts Hero with 3 AP and the team with 3 Momentum. The top panel describes the selected rules. These are prototype tuning values, not measured Monte Carlo outcomes.'], solve: ['Hero opens on 2. Gold-rimmed cards are playable now; dimmed cards are out of her reach under this tab. Each tab changes which cards light up, so try a line, switch tabs, and try it again.', 'Two-deep reach gives the dragon only its rear; Contested frontier lets it take the frontier 10 too. Position shifts cost 1 Momentum per column and reach the frontier 3 two columns over. Fanned back (frontier) cards cost 1 AP before their receipt. Reserve cards obey rank matching and refresh to three cards each party turn. Rotating rows cycle when the party ends its turn.'], why: ['Compare reach, resource costs, denial and predictability before choosing a movement system. Scenario 1000 uses three stacked rows with two-valued exposed cards.'] } } : TUTORIAL_SCENARIOS.find(def => def.id === id);
