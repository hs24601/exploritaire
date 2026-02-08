import type { OrimDefinition, Element } from '../engine/types';
import { ELEMENT_TO_SUIT, SUIT_COLORS } from '../engine/constants';
import { ACTOR_WATERCOLOR_TEMPLATE, buildActorWatercolorConfig } from './presets';
import { ORIM_WATERCOLOR_OVERRIDES } from './overrides';
import type { WatercolorConfig } from './types';

const ORIM_ELEMENT_PRIORITY: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

export const ORIM_WATERCOLOR_CANVAS_SCALE = 1.5;
export const ORIM_WATERCOLOR_OVERALL_SCALE_MULTIPLIER = 1 / ORIM_WATERCOLOR_CANVAS_SCALE;
export const ORIM_NEUTRAL_BASE_COLOR = '#3a3f41';

function getOrimPrimaryElement(definition: OrimDefinition | null): Element | null {
  if (!definition?.affinity) return null;
  let best: Element | null = null;
  let bestValue = -Infinity;
  for (const element of ORIM_ELEMENT_PRIORITY) {
    const value = definition.affinity[element];
    if (value === undefined) continue;
    if (value > bestValue) {
      bestValue = value;
      best = element;
    }
  }
  return best;
}

export function getOrimBaseColor(definition: OrimDefinition | null): string {
  const primaryElement = getOrimPrimaryElement(definition);
  if (!primaryElement) return ORIM_NEUTRAL_BASE_COLOR;
  const suit = ELEMENT_TO_SUIT[primaryElement];
  return SUIT_COLORS[suit] ?? ORIM_NEUTRAL_BASE_COLOR;
}

export function getOrimAccentColor(definition: OrimDefinition | null, orimId?: string): string {
  const resolvedId = orimId ?? definition?.id;
  const override = resolvedId
    ? ORIM_WATERCOLOR_OVERRIDES.find((entry) => entry.orimId === resolvedId)
    : undefined;
  if (override?.baseColor) return override.baseColor;
  return definition ? getOrimBaseColor(definition) : ORIM_NEUTRAL_BASE_COLOR;
}

export function getOrimWatercolorConfig(
  definition: OrimDefinition | null,
  orimId?: string
): WatercolorConfig | null {
  const resolvedId = orimId ?? definition?.id;
  if (!resolvedId) return null;
  const override = ORIM_WATERCOLOR_OVERRIDES.find((entry) => entry.orimId === resolvedId);
  const baseColor = override?.baseColor ?? (definition ? getOrimBaseColor(definition) : ORIM_NEUTRAL_BASE_COLOR);
  const template = override?.template ?? ACTOR_WATERCOLOR_TEMPLATE;
  const config = buildActorWatercolorConfig(baseColor, template);
  return {
    ...config,
    overallScale: config.overallScale * ORIM_WATERCOLOR_OVERALL_SCALE_MULTIPLIER,
    splotches: config.splotches.map((splotch) => ({ ...splotch, shape: 'circle' })),
  };
}
