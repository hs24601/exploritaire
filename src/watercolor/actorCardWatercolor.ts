import type { Actor, ActorDeckState, Element, OrimDefinition, OrimInstance } from '../engine/types';
import { ELEMENT_TO_SUIT, SUIT_COLORS } from '../engine/constants';
import type { SplotchConfig, WatercolorConfig } from './types';
import { DEFAULT_ANIMATION, DEFAULT_GRAIN, DEFAULT_SATELLITES, DEFAULT_TENDRILS } from './constants';
import { ACTOR_WATERCOLOR_OVERRIDES } from './overrides';
import { ACTOR_WATERCOLOR_TEMPLATE, buildActorWatercolorConfig } from './presets';

const NEUTRAL_COLOR = '#3a3f41';

type PaletteSlot = 'affinity' | 'primary' | 'secondary' | 'neutral';

export type ActorCardSplotchBlueprint = Omit<SplotchConfig, 'gradient'> & {
  gradientScale: number;
  baseColor?: string;
  paletteSlot?: PaletteSlot;
  minLevel?: number;
  minOrimCount?: number;
  minAffinity?: number;
};

export type ActorCardWatercolorBlueprint = {
  splotches: ActorCardSplotchBlueprint[];
  grain: WatercolorConfig['grain'];
  overallScale: number;
};

export const ACTOR_CARD_WATERCOLOR_BLUEPRINT: ActorCardWatercolorBlueprint = {
  splotches: [
    {
      gradientScale: 0.6,
      scale: 0.7,
      offset: [0, 0],
      blendMode: 'screen',
      opacity: 0.4,
      shape: 'circle',
      tendrils: { ...DEFAULT_TENDRILS, count: 2, lengthMin: 80, lengthMax: 140, strokeWidth: 5 },
      satellites: { ...DEFAULT_SATELLITES, count: 2, radiusMin: 10, radiusMax: 18, orbitRadius: 120 },
      animation: { ...DEFAULT_ANIMATION, breatheDuration: 11, breatheScale: 1.03, highlightShiftDuration: 9 },
      paletteSlot: 'affinity',
      minLevel: 1,
    },
    {
      gradientScale: 0.45,
      scale: 0.5,
      offset: [0.06, -0.06],
      blendMode: 'screen',
      opacity: 0.28,
      shape: 'circle',
      tendrils: { ...DEFAULT_TENDRILS, count: 1, lengthMin: 50, lengthMax: 90, strokeWidth: 4 },
      satellites: { ...DEFAULT_SATELLITES, count: 1, radiusMin: 8, radiusMax: 14, orbitRadius: 90 },
      animation: { ...DEFAULT_ANIMATION, breatheDuration: 13, breatheScale: 1.02, highlightShiftDuration: 11 },
      paletteSlot: 'secondary',
      minLevel: 3,
    },
    {
      gradientScale: 0.3,
      scale: 0.75,
      offset: [-0.04, 0.08],
      blendMode: 'screen',
      opacity: 0.18,
      shape: 'rectangle',
      tendrils: { ...DEFAULT_TENDRILS, count: 1, lengthMin: 40, lengthMax: 70, strokeWidth: 3 },
      satellites: { ...DEFAULT_SATELLITES, count: 1, radiusMin: 6, radiusMax: 12, orbitRadius: 70 },
      animation: { ...DEFAULT_ANIMATION, breatheDuration: 14, breatheScale: 1.02, highlightShiftDuration: 12 },
      paletteSlot: 'primary',
    },
  ],
  grain: { ...DEFAULT_GRAIN, intensity: 0.04 },
  overallScale: 1,
};

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) => (
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
);

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const lighten = (hex: string, amount: number) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(mix(r, 255, amount), mix(g, 255, amount), mix(b, 255, amount));
};

const darken = (hex: string, amount: number) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(mix(r, 0, amount), mix(g, 0, amount), mix(b, 0, amount));
};

const deriveGradientColors = (hex: string) => ({
  light: lighten(hex, 0.55),
  mid: hex,
  dark: darken(hex, 0.55),
});

const makeGradient = (hex: string, opacityScale = 1) => {
  const { light, mid, dark } = deriveGradientColors(hex);
  return {
    light,
    mid,
    dark,
    lightOpacity: 0.9 * opacityScale,
    midOpacity: 0.8 * opacityScale,
    darkOpacity: 0.7 * opacityScale,
  };
};

const createEmptyAffinityTotals = (): Record<Element, number> => ({
  W: 0, E: 0, A: 0, F: 0, L: 0, D: 0, N: 0,
});

const getActorAffinity = (
  actorDeck: ActorDeckState | undefined,
  orimInstances: Record<string, OrimInstance>,
  orimDefinitions: OrimDefinition[],
) => {
  const totals = createEmptyAffinityTotals();
  if (!actorDeck) return totals;
  const orimLookup = new Map<string, OrimDefinition>(orimDefinitions.map((def) => [def.id, def]));
  actorDeck.cards.forEach((card) => {
    card.slots.forEach((slot) => {
      if (!slot.orimId) return;
      const instance = orimInstances[slot.orimId];
      if (!instance) return;
      const definition = orimLookup.get(instance.definitionId);
      if (!definition) return;
      definition.elements.forEach((element) => {
        totals[element] += 1;
      });
      if (definition.affinity) {
        Object.entries(definition.affinity).forEach(([element, value]) => {
          totals[element as Element] += value ?? 0;
        });
      }
    });
  });
  return totals;
};

const getDominantElement = (totals: Record<Element, number>) => {
  let best: Element = 'N';
  let bestValue = 0;
  (Object.keys(totals) as Element[]).forEach((element) => {
    const value = totals[element] ?? 0;
    if (value > bestValue) {
      bestValue = value;
      best = element;
    }
  });
  return { element: best, value: bestValue };
};

const getElementColor = (element: Element) => {
  if (element === 'N') return NEUTRAL_COLOR;
  const suit = ELEMENT_TO_SUIT[element];
  return SUIT_COLORS[suit] ?? NEUTRAL_COLOR;
};

export const getActorCardWatercolor = (
  actor: Actor,
  actorDeck: ActorDeckState | undefined,
  orimInstances: Record<string, OrimInstance>,
  orimDefinitions: OrimDefinition[],
  blueprint: ActorCardWatercolorBlueprint = ACTOR_CARD_WATERCOLOR_BLUEPRINT,
): WatercolorConfig => {
  const override = ACTOR_WATERCOLOR_OVERRIDES.find((entry) => entry.actorId === actor.definitionId);
  if (override) {
    return buildActorWatercolorConfig(override.baseColor, override.template ?? ACTOR_WATERCOLOR_TEMPLATE);
  }
  const affinityTotals = getActorAffinity(actorDeck, orimInstances, orimDefinitions);
  const { element: dominantElement, value: affinityStrength } = getDominantElement(affinityTotals);
  const affinityColor = getElementColor(dominantElement);
  const palette = {
    affinity: affinityColor,
    primary: affinityColor,
    secondary: lighten(affinityColor, 0.2),
    neutral: NEUTRAL_COLOR,
  } satisfies Record<PaletteSlot, string>;

  const orimCount = actorDeck
    ? actorDeck.cards.reduce((sum, card) => (
      sum + card.slots.reduce((slotSum, slot) => slotSum + (slot.orimId ? 1 : 0), 0)
    ), 0)
    : 0;

  const splotches = blueprint.splotches
    .filter((splotch) => {
      if (splotch.minLevel && actor.level < splotch.minLevel) return false;
      if (splotch.minOrimCount && orimCount < splotch.minOrimCount) return false;
      if (splotch.minAffinity && affinityStrength < splotch.minAffinity) return false;
      return true;
    })
    .map((splotch) => {
      const baseColor = splotch.baseColor
        ?? (splotch.paletteSlot ? palette[splotch.paletteSlot] : palette.affinity);
      return {
        ...splotch,
        gradient: makeGradient(baseColor, splotch.gradientScale),
      };
    });

  return {
    splotches,
    grain: blueprint.grain,
    overallScale: blueprint.overallScale,
  };
};
