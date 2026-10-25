import type { StatusSkillId, UnitStatus } from './battleStatusData';

// Tutorial and focused combat-sandbox scenarios, as data over the turn-based
// combatsbx rules (rules/battleTutorials.ts builds them). Every enemy is a
// Khad Root. Each card a foundation receives banks 1 AP for that Kin (cap 6)
// and 1 shared Momentum; ability cards cost their owner's AP. Insight copy is
// the long-form explanation shown by the Insight buff on one party member.

export type TutorialScenarioId = '008' | '009' | '010' | '011' | '012' | '013' | '014' | '015' | '016' | '017' | '018' | '019' | '020' | '021' | '022' | '023' | '024' | '1000';
export type TutorialFoeDef = {
  key: string; name: string; hp: number; damage: number; staggerMax: number;
  /** Debuff placed on the Kin it strikes. */
  inflicts?: 'sap' | 'silence';
  /** Statuses it starts each wave with. */
  statuses?: UnitStatus[];
};
export type StrikeProfile = { name: string; damage: number; stagger: number };
/**
 * An enemy intent played as a golf card on the table (rules/battleDeadRun.ts).
 * Each enemy turn its owner plays up to `enemyPlays` matching tableau cards onto
 * it and adds `passive` pips; at `pips` it fires on every living Kin, then
 * returns as a fresh card. Each party card played on it removes a pip and earns
 * Momentum, but no AP and no hit. `fixedRank` keeps its rank when played on.
 */
export type IntentCardDef = { name: string; pips: number; enemyPlays: number; passive: number; damage: number; fixedRank?: boolean };
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
  party?: readonly ('hero' | 'mochi')[];
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
  insight: { actorId: 'hero' | 'mochi'; intent: string[]; solve: string[]; why: string[] };
};

const ALL_SKILLS = ['bash', 'ember-rage', 'focus-fire', 'bite', 'takedown', 'vice-grip', 'frost-fang', 'thunder-bark', 'guard', 'regen', 'foresight',
  'hold', 'pounce', 'sticky-paws', 'lacerate', 'puddle-pounce', 'ember-swipe', 'haste', 'mire', 'wild',
  'cir-hearthflame', 'cir-ember-claws', 'cir-meteor'] as const;

/** Shared reading of the AP model, reused across Insight pages. */
const LINES = 'Under ±1 rules one card rarely fits both foundations (about 0.4 times a turn on this table), so the real choice is which line, which run of cards, you feed to which Kin.';

// Dead-run permutations (019–024): Hero alone on six columns against one
// foe, with the same seed and tuning, so each fix compares like for like.
const BELLOWS_ROOT: TutorialFoeDef = { key: 'bellows-root', name: 'Bellows Khad Root', hp: 16, damage: 1, staggerMax: 6 };
export const DEEP_BREATH: IntentCardDef = { name: 'Deep Breath', pips: 4, enemyPlays: 2, passive: 1, damage: 4 };
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
      'Deep Breath plus the pity flip. When a turn opens with nothing legal (no card fits Hero or Deep Breath), PITY FLIP turns one free card from the stock onto Hero’s foundation. It works once, and only at the start of a dead turn.',
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
      'Every dead-run fix at once, at the Monte Carlo’s starting tuning: Deep Breath (4 pips, up to 2 enemy plays and 1 passive pip a turn), one pity flip when a turn opens dead, and a hold slot.',
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

export const TUTORIAL_SCENARIOS: readonly TutorialDef[] = [
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
  { id: '1000', name: '1000: Target Dummy', seed: 1000, randomSeed: true, skills: ['hold'], kinRadials: true, hideEmptySlot: true, columns: 6, party: ['hero'], partyHp: 99, enemyTurnSeconds: 1,
    foes: [{ key: 'target-dummy', name: 'Target Dummy', hp: 999, damage: 0, staggerMax: 6 }],
    intentCard: DEEP_BREATH, pityDraw: true,
    insight: { actorId: 'hero',
      intent: [
        'A test range for the dead-run systems, built like 999: a 999-HP Target Dummy that never strikes, so you can try every rule without the fight ending. Hero fights alone on six columns, with a fresh random deal on every start and restart. Hero has 99 HP.',
        'Everything is on at once: the Deep Breath intent card (4 pips; up to 2 enemy plays and 1 passive pip a turn; it fires for 4 on every Kin), the pity flip, the delayed-redeal Withdraw and the board-plan markers. The hold slot is an ability here: Hero’s Hold card (6 AP) opens it for the rest of the fight.',
        'The enemy turn plays out one action at a time: its strike, each card it plays onto Deep Breath, then the passive pip, so you can watch every change land.',
      ],
      solve: [
        'Deep Breath: tap or drag a card one rank from it to remove a pip (1 Momentum, no AP or Nip). Red outlines mark the exposed cards the dummy will play onto it next turn; take them first to starve it.',
        'Hold: tap Hero’s foundation to open her abilities and play Hold once she has banked 6 AP (1 per card she receives). The Hold slot appears beside her. Drag a card she could take right now into it, then drag or tap it out on a later turn. Parking also exposes the card underneath without changing Hero’s value.',
        'Pity flip: when a turn opens with nothing legal, PITY FLIP turns one free stock card onto Hero’s foundation.',
        'Withdraw: pick a row and your turn ends. A mint band marks that row while the dummy acts on the current board, and your next turn opens on it.',
      ],
      why: [
        'Scenarios 019–024 each test one permutation against a real threat. This range puts them all together with no pressure, so you can check how they read and feel side by side before tuning them.',
        'The dummy keeps 999 HP like the Dark Tyrant, so a long session never ends in a win screen. Restart for a new deal.',
      ] } },
];

export const tutorialById = (id: string | undefined) => TUTORIAL_SCENARIOS.find(def => def.id === id);
