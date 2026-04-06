export type GolfStarterAbilityCategory = 'signature' | 'tableau-clear' | 'tool' | 'battle' | 'passive';

export type GolfHandEffect =
  | 'sticky-paws'
  | 'repurpose'
  | 'paw-sperity'
  | 'path-of-stars'
  | 'jikan'
  | 'ironfur'
  | 'tap-out'
  | 'slipstream'
  | 'battery'
  | 'siphon'
  | 'rigged-construct'
  | 'rewire'
  | 'scrap-plating'
  | 'aegis-shunt'
  | 'fetch'
  | 'vice-grip'
  | 'banks-strike'
  | 'hero-guard';

export type GolfKinFamily = 'canid' | 'felis' | 'mustelid' | 'corvid' | 'other';
export type GolfAbilityFocus = 'tableau' | 'combat' | 'hybrid' | 'support';
export type GolfSignatureMutationTier = 'branch' | 'orim-upgraded';

export type GolfKinEffectDefinition = {
  key: string;
  label: string;
  tone: 'buff' | 'debuff';
  name: string;
  flavorText: string;
  effectText: string;
};

export type GolfStarterAbility = {
  name: string;
  fullName?: string;
  category: GolfStarterAbilityCategory;
  combatDescription: string;
  exploreDescription: string;
  effect: GolfHandEffect | null;
  cost?: string;
  focus?: GolfAbilityFocus;
};

export type GolfPassiveTraitDefinition = {
  name: string;
  flavorText: string;
  effectText: string;
  combatDescription: string;
  exploreDescription: string;
};

export type GolfSignatureMutationDefinition = {
  id: string;
  name: string;
  tier: GolfSignatureMutationTier;
  summary: string;
  combatDescription: string;
  exploreDescription: string;
};

export type GolfCollapseDefinition = {
  name: string;
  role: string;
  combatDescription: string;
};

export type GolfStarterKinKitDefinition = {
  signature: GolfStarterAbility;
  passiveTrait?: GolfPassiveTraitDefinition;
  collapse?: GolfCollapseDefinition;
  signatureMutations: GolfSignatureMutationDefinition[];
  compatibleOrimIds: string[];
  legacyNotes?: string[];
};

export const STARTER_KIN_METADATA: Record<string, { benchWeight: number; abilityName: string | null; apCap?: number }> = {
  Mochi: { benchWeight: 1, abilityName: 'Tap Out!', apCap: 6 },
  Banks: { benchWeight: 1, abilityName: 'Swipe', apCap: 3 },
  Hero: { benchWeight: 1, abilityName: 'Fetch', apCap: 8 },
  Jet: { benchWeight: 1, abilityName: 'Rewire', apCap: 8 },
  Whis: { benchWeight: 1, abilityName: 'Jikan', apCap: 4 },
  Pan: { benchWeight: 1, abilityName: 'Path of Stars', apCap: 10 },
};

export const KIN_EFFECT_DEFS: Record<string, GolfKinEffectDefinition> = {
  'nine lives': {
    key: 'nine-lives',
    label: '9L',
    tone: 'buff',
    name: 'NINE LIVES',
    flavorText: '*Not actually nine, but so uncanny are Felis kins\' ability to narrowly escape death that the effect has been exaggerated.*',
    effectText: 'Upon receiving fatal damage, set HP to 1 and apply **Narrow Escape** and **Skittish**. Resets on long rest.',
  },
  'narrow escape': {
    key: 'narrow-escape',
    label: 'NE',
    tone: 'buff',
    name: 'NARROW ESCAPE',
    flavorText: '*Avoided a cat-astrophe.*',
    effectText: 'Evasion +20% while HP is 1.',
  },
  skittish: {
    key: 'skittish',
    label: 'SK',
    tone: 'debuff',
    name: 'SKITTISH',
    flavorText: '*Scared. of. Everything.*',
    effectText: 'Cannot swap to prime for 5 actions.',
  },
  'wild spirit': {
    key: 'wild-spirit',
    label: 'WS',
    tone: 'buff',
    name: 'WILD SPIRIT',
    flavorText: '*Pressure turns into instinct, and instinct turns into momentum.*',
    effectText: 'Triggered by Hero taking pressure or rotating in to protect the line. Every 3 stacks grant +1 armor and create a **Wildcard**.',
  },
  'guard dog': {
    key: 'guard-dog',
    label: 'GD',
    tone: 'buff',
    name: 'GUARD DOG',
    flavorText: '*No packmate falls while Hero can still stand.*',
    effectText: 'If an ally would die, Hero intercepts that lethal damage instead.',
  },
  whiskersense: {
    key: 'whiskersense',
    label: 'WS',
    tone: 'buff',
    name: 'WHISKERSENSE',
    flavorText: '*She was already gone before the hit arrived.*',
    effectText: 'Negates the next incoming damage source. While active, Tap Out! can convert into Zoomies.',
  },
  momentum: {
    key: 'momentum',
    label: 'MO',
    tone: 'buff',
    name: 'MOMENTUM',
    flavorText: '*Fast feet, faster instincts.*',
    effectText: 'Adds bonus poke damage equal to current stacks. Loses 1 stack per turn.',
  },
};

export const getKinEffectDefinition = (name: string) => KIN_EFFECT_DEFS[name.trim().toLowerCase()] ?? null;

export const KIN_PROFILE_DEFS: Record<string, {
  pronouns: { subject: string; object: string; possessive: string };
  family: GolfKinFamily;
  passiveName?: string;
  passiveFlavor?: string;
  passiveEffect?: string;
}> = {
  Mochi: {
    pronouns: { subject: 'she', object: 'her', possessive: 'her' },
    family: 'felis',
    passiveName: 'Nine Lives',
    passiveFlavor: KIN_EFFECT_DEFS['nine lives'].flavorText,
    passiveEffect: KIN_EFFECT_DEFS['nine lives'].effectText,
  },
  Hero: {
    pronouns: { subject: 'he', object: 'him', possessive: 'his' },
    family: 'canid',
    passiveName: 'Guard Dog',
    passiveFlavor: KIN_EFFECT_DEFS['guard dog'].flavorText,
    passiveEffect: KIN_EFFECT_DEFS['guard dog'].effectText,
  },
  Banks: {
    pronouns: { subject: 'he', object: 'him', possessive: 'his' },
    family: 'mustelid',
  },
  Jet: {
    pronouns: { subject: 'he', object: 'him', possessive: 'his' },
    family: 'other',
  },
  Whis: {
    pronouns: { subject: 'they', object: 'them', possessive: 'their' },
    family: 'corvid',
  },
};

export const getKinProfile = (kinName: string) => KIN_PROFILE_DEFS[kinName] ?? {
  pronouns: { subject: 'they', object: 'them', possessive: 'their' },
  family: 'other' as GolfKinFamily,
};

export const STARTER_KIN_KITS: Record<string, GolfStarterKinKitDefinition> = {
  Mochi: {
    signature: {
      name: 'Tap Out!',
      category: 'signature',
      combatDescription: 'Pivot Mochi out of danger and convert tempo into a safer line.',
      exploreDescription: 'Mochi turns a risky route into a survivable one without giving up the chase.',
      effect: 'tap-out',
      cost: '2-4',
      focus: 'hybrid',
    },
    passiveTrait: {
      name: 'Nine Lives',
      flavorText: KIN_EFFECT_DEFS['nine lives'].flavorText,
      effectText: KIN_EFFECT_DEFS['nine lives'].effectText,
      combatDescription: 'If fatal damage would land, Mochi instead stays at 1 HP, gains Narrow Escape, and becomes Skittish until she calms down.',
      exploreDescription: 'FELIS kin have a reputation for surviving what should have ended the run. The myth sticks because it keeps happening.',
    },
    collapse: {
      name: 'Pounce',
      role: 'Stagger specialist',
      combatDescription: 'Cash out built pressure into high stagger gain. Mochi is meant to convert Momentum and exposed openings into rapid pressure spikes more efficiently than raw HP damage.',
    },
    signatureMutations: [],
    compatibleOrimIds: ['efficiency', 'sustain', 'echo'],
  },
  Banks: {
    signature: {
      name: 'Swipe',
      fullName: 'Swipe / Hit and Run',
      category: 'signature',
      combatDescription: 'Spend all current Banks AP. At 1 AP, deal 1 physical. At 2 AP, deal 2 physical. At 3 AP, use Hit and Run: deal 3 physical, then enter Prowl with 100% evasion until the next beneficial tick breaks it.',
      exploreDescription: 'Banks spikes when the player lines up exact AP breakpoints and cashes them out at the right time.',
      effect: 'banks-strike',
      cost: '1-3',
      focus: 'combat',
    },
    passiveTrait: {
      name: 'Prowl',
      flavorText: '*Hit, disappear, reappear where the line is weakest.*',
      effectText: 'At full cashout, Banks enters Prowl and cannot be cleanly answered until the next beneficial tick breaks concealment.',
      combatDescription: 'Exact AP breakpoints unlock evasive follow-through after Banks commits.',
      exploreDescription: 'Banks rewards precise tempo planning instead of broad board control.',
    },
    signatureMutations: [],
    compatibleOrimIds: ['efficiency', 'force', 'echo'],
  },
  Jet: {
    signature: {
      name: 'Rewire',
      category: 'signature',
      combatDescription: 'Spend 3 AP to make one lateral tableau-to-tableau move if the destination would be foundation legal. The moved tableau card becomes Charged.',
      exploreDescription: 'Jet reshapes legal lanes directly instead of waiting for the board to open on its own.',
      effect: 'rewire',
      cost: '3',
      focus: 'tableau',
    },
    passiveTrait: {
      name: 'High Capacity',
      flavorText: '*Jet banks voltage until the whole squad can use it.*',
      effectText: 'Jet stores extra AP so rewires can chain into larger team turns.',
      combatDescription: 'Jet stores up to 5 AP so he can chain multiple rewires and preload bigger ally turns.',
      exploreDescription: 'Deferred tempo is Jet’s real resource, not direct burst.',
    },
    signatureMutations: [],
    compatibleOrimIds: ['efficiency', 'reach', 'echo'],
  },
  Hero: {
    signature: {
      name: 'Fetch',
      category: 'signature',
      combatDescription: 'Tableau: retrieve any top-row tableau card into Hero’s hand. Actor: retrieve the top card from any creature discard and put it into Hero’s hand.',
      exploreDescription: 'Hero bridges dead tableau lanes by pulling a visible card into hand, or reuses the latest creature discard as a fresh line piece.',
      effect: 'fetch',
      cost: '2',
      focus: 'hybrid',
    },
    passiveTrait: {
      name: 'Guard Dog',
      flavorText: KIN_EFFECT_DEFS['guard dog'].flavorText,
      effectText: KIN_EFFECT_DEFS['guard dog'].effectText,
      combatDescription: 'Hero steps in and takes lethal damage that would otherwise kill an ally.',
      exploreDescription: 'The pack keeps moving because Hero refuses to let a friend fall first.',
    },
    collapse: {
      name: 'Tackle',
      role: 'Protective finisher',
      combatDescription: 'Cash out built pressure into real damage, then grant 1 armor per current Hero AP, distributed evenly across the party. Any uneven armor favors allies with lower current HP ratio first, then lower max HP.',
    },
    signatureMutations: [
      {
        id: 'dig',
        name: 'Dig',
        tier: 'branch',
        summary: 'Fetch from any tableau depth or any depth of a creature discard pile.',
        combatDescription: 'Instead of only the top discard, Hero can choose any discarded card from a creature pile.',
        exploreDescription: 'Hero can pull from any tableau depth, including buried reward-token cards.',
      },
      {
        id: 'old-dog-new-tricks',
        name: 'Old Dog, New Tricks',
        tier: 'branch',
        summary: 'Fetched cards become permanent exhausted additions to Hero’s hand.',
        combatDescription: 'Fetched creature cards stay in Hero’s kit for the run, but enter exhausted until long rest.',
        exploreDescription: 'Fetched tableau cards become permanent exhausted hand tools instead of one-off grabs.',
      },
      {
        id: 'underdog',
        name: 'Underdog',
        tier: 'branch',
        summary: 'While Hero is in support, fetched cards remain usable in the active prime hand.',
        combatDescription: 'Fetched combat tools persist in the current prime’s hand while Hero supports from the bench.',
        exploreDescription: 'Support Hero can keep feeding the active prime new puzzle pieces without taking prime himself.',
      },
    ],
    compatibleOrimIds: ['efficiency', 'cal', 'reach', 'persistence', 'echo'],
    legacyNotes: [
      'Golf runtime still contains legacy Hero systems such as Wild Spirit and wildcard generation.',
      'Fetch is now the intended long-term signature chassis for Hero kit design.',
    ],
  },
  Pan: {
    signature: {
      name: 'Path of Stars',
      category: 'signature',
      combatDescription: 'Spend AP to reveal the optimal future route.',
      exploreDescription: 'Reveal the optimal hidden tableau route for the next several steps.',
      effect: 'path-of-stars',
      cost: '10+',
      focus: 'tableau',
    },
    passiveTrait: {
      name: 'Lucky Reversal',
      flavorText: '*Variance bends toward the patient paw.*',
      effectText: 'Bad variance can flip into AP and a counter-opening when Pan avoids a collapse.',
      combatDescription: 'On dodge, Pan gains AP and counter pressure.',
      exploreDescription: 'Bad variance can still open a new route if Pan is already aligned for it.',
    },
    signatureMutations: [],
    compatibleOrimIds: ['reach', 'sustain', 'echo'],
  },
  Whis: {
    signature: {
      name: 'Jikan',
      fullName: 'Jikan Makimodoshi',
      category: 'signature',
      combatDescription: 'Spend AP to undo the last combat play.',
      exploreDescription: 'Perform a time heist: rewind the last tableau card back to its column while Whis keeps the gained rank.',
      effect: 'jikan',
      cost: '2',
      focus: 'hybrid',
    },
    passiveTrait: {
      name: 'Afterimage',
      flavorText: '*A future step can still trip over the ghost of the last one.*',
      effectText: 'Successful dodges leave an exploitable echo that adds counter-pressure.',
      combatDescription: 'Successful dodges grant bonus counter damage.',
      exploreDescription: 'Past states leave echoes you can still exploit.',
    },
    signatureMutations: [],
    compatibleOrimIds: ['efficiency', 'reach', 'echo'],
  },
};

export const STARTER_ABILITIES: Record<string, GolfStarterAbility[]> = Object.fromEntries(
  Object.entries(STARTER_KIN_KITS).map(([kinName, kit]) => {
    const passiveSlots: GolfStarterAbility[] = kit.passiveTrait
      ? [{
        name: kit.passiveTrait.name,
        category: 'passive',
        combatDescription: kit.passiveTrait.combatDescription,
        exploreDescription: kit.passiveTrait.exploreDescription,
        effect: null,
      }]
      : [];
    return [kinName, [kit.signature, ...passiveSlots]];
  }),
) as Record<string, GolfStarterAbility[]>;

export const getStarterPackAbilityName = (cardName: string, rarity: 1 | 2 | 3) => {
  if (cardName === 'Banks') return rarity >= 3 ? 'Hit and Run' : 'Swipe';
  return STARTER_KIN_KITS[cardName]?.signature.name ?? STARTER_KIN_METADATA[cardName]?.abilityName ?? null;
};

export const getActorApCap = (actorName: string) => STARTER_KIN_METADATA[actorName]?.apCap ?? 2;
export const getStarterKinKit = (kinName: string) => STARTER_KIN_KITS[kinName] ?? null;

export const getStarterAbilityByEffect = (effect: string | null) => (
  Object.values(STARTER_ABILITIES)
    .flat()
    .find((ability) => ability.effect === effect) ?? null
);
