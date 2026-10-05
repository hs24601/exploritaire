export type GolfOrimRarity = 'common' | 'uncommon' | 'rare';
export type GolfOrimTarget = 'signature' | 'kin';
export type GolfOrimFamily = 'efficiency' | 'cal' | 'reach' | 'persistence' | 'force' | 'echo' | 'sustain';

export type GolfOrimDefinition = {
  id: string;
  name: string;
  family: GolfOrimFamily;
  target: GolfOrimTarget;
  summary: string;
  designRole: string;
  rarityScaling: Record<GolfOrimRarity, string>;
};

export const GOLF_ORIM_DEFINITIONS: GolfOrimDefinition[] = [
  {
    id: 'efficiency',
    name: 'Efficiency Orim',
    family: 'efficiency',
    target: 'signature',
    summary: 'Reduces the AP burden of a signature ability.',
    designRole: 'Lets a chosen signature become a repeatable tempo tool without changing its targeting rules.',
    rarityScaling: {
      common: '-1 AP cost to the attached signature where legal.',
      uncommon: '-2 AP cost to the attached signature where legal.',
      rare: '-3 AP cost to the attached signature where legal.',
    },
  },
  {
    id: 'cal',
    name: 'Cal Orim',
    family: 'cal',
    target: 'signature',
    summary: 'Adds a fire rider that keys off the fetched or affected rank.',
    designRole: 'Bridges tableau manipulation into combat pressure without changing the base signature identity.',
    rarityScaling: {
      common: 'When the attached signature affects a card, matching enemy foundation ranks ignite for 1 fire damage.',
      uncommon: 'Matching enemy foundation ranks ignite for 2 fire damage.',
      rare: 'Matching enemy foundation ranks ignite for 3 fire damage and refresh burn duration.',
    },
  },
  {
    id: 'reach',
    name: 'Reach Orim',
    family: 'reach',
    target: 'signature',
    summary: 'Extends what the signature is allowed to target.',
    designRole: 'Pushes signatures toward deeper tableau, wider discard access, or more flexible lane geometry.',
    rarityScaling: {
      common: 'Extends the attached signature one step beyond its normal target restrictions.',
      uncommon: 'Extends the signature two steps beyond its normal target restrictions.',
      rare: 'Removes most depth-based restrictions from the attached signature.',
    },
  },
  {
    id: 'persistence',
    name: 'Persistence Orim',
    family: 'persistence',
    target: 'signature',
    summary: 'Makes a signature’s gained value last longer.',
    designRole: 'Turns one-shot signatures into hand-building or support-persistent tools.',
    rarityScaling: {
      common: 'Generated or retrieved cards remain available for one extra use.',
      uncommon: 'Generated or retrieved cards remain available until end of combat.',
      rare: 'Generated or retrieved cards become exhausted permanent additions until long rest.',
    },
  },
  {
    id: 'force',
    name: 'Force Orim',
    family: 'force',
    target: 'signature',
    summary: 'Adds direct impact when the signature is used aggressively.',
    designRole: 'Converts a precision signature into a more forceful finisher without replacing the core puzzle verb.',
    rarityScaling: {
      common: 'Adds a small damage or armor-break rider to the attached signature.',
      uncommon: 'Adds a stronger rider and a brief exposed or stagger window.',
      rare: 'Adds a strong rider and a secondary payoff against already-marked targets.',
    },
  },
  {
    id: 'echo',
    name: 'Echo Orim',
    family: 'echo',
    target: 'signature',
    summary: 'Repeats part of a signature’s payoff after a short delay or on the next allied trigger.',
    designRole: 'Creates layered turns without forcing every signature to become a burst tool.',
    rarityScaling: {
      common: 'Repeats a light version of the signature payoff once.',
      uncommon: 'Repeats a medium version of the payoff on the next allied trigger.',
      rare: 'Creates a full-strength delayed echo once per turn.',
    },
  },
  {
    id: 'sustain',
    name: 'Sustain Orim',
    family: 'sustain',
    target: 'kin',
    summary: 'Adds defensive or healing value to a creature or its signature.',
    designRole: 'Lets puzzle-focused signatures still contribute to survivability and long fights.',
    rarityScaling: {
      common: 'Gain a small heal or shield when the attached effect resolves.',
      uncommon: 'Gain a moderate heal or shield and cleanse one light debuff.',
      rare: 'Gain a strong heal or shield and grant a team sustain rider.',
    },
  },
];

export const getGolfOrimDefinition = (orimId: string) => (
  GOLF_ORIM_DEFINITIONS.find((definition) => definition.id === orimId) ?? null
);
