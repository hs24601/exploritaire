import type { StatusSkillId, UnitStatus } from './battleStatusData';

// Tutorial and focused combat-sandbox scenarios, as data over the turn-based
// combatsbx rules (rules/battleTutorials.ts builds them). Every enemy is a
// Khad Root. Each card a foundation receives banks 1 AP for that Kin (cap 6)
// and 1 shared Momentum; ability cards cost their owner's AP. Insight copy is
// the long-form explanation shown by the Insight buff on one party member.

export type TutorialScenarioId = '008' | '009' | '010' | '011' | '012' | '013' | '014' | '015' | '016' | '017' | '018';
export type TutorialFoeDef = {
  key: string; name: string; hp: number; damage: number; staggerMax: number;
  /** Debuff placed on the Kin it strikes. */
  inflicts?: 'sap' | 'silence';
  /** Statuses it starts each wave with. */
  statuses?: UnitStatus[];
};
export type StrikeProfile = { name: string; damage: number; stagger: number };
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
  insight: { actorId: 'hero' | 'mochi'; intent: string[]; solve: string[]; why: string[] };
};

const ALL_SKILLS = ['bash', 'ember-rage', 'focus-fire', 'bite', 'takedown', 'vice-grip', 'frost-fang', 'thunder-bark', 'guard', 'regen', 'foresight',
  'pounce', 'sticky-paws', 'lacerate', 'puddle-pounce', 'ember-swipe', 'haste', 'mire', 'wild',
  'cir-hearthflame', 'cir-ember-claws', 'cir-meteor'] as const;

/** Shared reading of the AP model, reused across Insight pages. */
const LINES = 'Under ±1 rules one card rarely fits both foundations (about 0.4 times a turn on this table), so the real choice is which line, which run of cards, you feed to which Kin.';

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
        'The root banks 2 Momentum each turn and spends 4 on a Heavy Strike for double damage, so every second strike hurts. No moves left? Withdraw, in the Momentum dial, redeals the whole tableau but ends your turn.',
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
        'Without Focus Fire your only move is Withdraw, which redeals and hands the root a free turn.',
      ],
      why: [
        'Most abilities change the fight; Focus Fire changes the board. It teaches that the tableau itself is a target: one rank can be the wall between you and a ten-card turn.',
        'It costs AP that Hero could spend on Bash, and the cards it burns earn nothing, so it is only worth it when the run it opens is longer than the cards it removes.',
      ] } },
];

export const tutorialById = (id: string | undefined) => TUTORIAL_SCENARIOS.find(def => def.id === id);
