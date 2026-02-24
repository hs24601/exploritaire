import type { OrimDefinition, Element } from '../engine/types';
import { ELEMENT_TO_SUIT, SUIT_COLORS } from '../engine/constants';

const ORIM_ELEMENT_PRIORITY: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

export const ORIM_NEUTRAL_BASE_COLOR = '#3a3f41';

function getOrimPrimaryElement(definition: OrimDefinition | null): Element | null {
  if (!definition) return null;
  if (definition.affinity) {
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
    if (best) return best;
  }
  return definition.elements[0] ?? null;
}

export function getOrimBaseColor(definition: OrimDefinition | null): string {
  const primaryElement = getOrimPrimaryElement(definition);
  if (!primaryElement) return ORIM_NEUTRAL_BASE_COLOR;
  const suit = ELEMENT_TO_SUIT[primaryElement];
  return SUIT_COLORS[suit] ?? ORIM_NEUTRAL_BASE_COLOR;
}

export function getOrimAccentColor(definition: OrimDefinition | null, _orimId?: string): string {
  return definition ? getOrimBaseColor(definition) : ORIM_NEUTRAL_BASE_COLOR;
}
