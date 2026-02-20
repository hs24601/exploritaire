import type { Element } from './types';

/**
 * Elemental Strengths & Weaknesses Matrix
 *
 * Format: ELEMENTAL_MATRIX[attackingElement][targetElement] = multiplier
 *
 * Multiplier meanings:
 *   2.0 = super effective (Light/Dark only)
 *   1.5 = effective
 *   1.0 = neutral
 *   0.5 = resisted
 *
 * Example: Fire attacking Water = 0.5x (fire is weak to water)
 *          Water attacking Fire = 2.0x (water douses fire)
 *
 * Thematic rationale:
 *   - Water: Douses fire (2.0x), absorbs earth (1.5x). Neutral elsewhere.
 *   - Earth: Absorbs water (1.5x), blocks air/wind (1.5x). Melted by fire (0.5x).
 *   - Air: Erodes earth (1.5x). Cannot fight fire effectively (0.5x).
 *   - Fire: Burns organic matter & chars earth (1.5x each). Extinguished by water (0.5x).
 *   - Light: Annihilates darkness (2.0x). Neutral vs all others.
 *   - Dark: Overwhelms light (2.0x). Neutral vs all others.
 *   - Non-elemental: Always 1.0 — never modified by elemental math.
 */
export const ELEMENTAL_MATRIX: Record<Element, Record<Element, number>> = {
  W: { W: 1.0, E: 1.5, A: 1.0, F: 2.0, L: 1.0, D: 1.0, N: 1.0 },  // Water
  E: { W: 1.5, E: 1.0, A: 1.5, F: 0.5, L: 1.0, D: 1.0, N: 1.0 },  // Earth
  A: { W: 1.0, E: 1.5, A: 1.0, F: 0.5, L: 1.0, D: 1.0, N: 1.0 },  // Air
  F: { W: 0.5, E: 1.5, A: 1.5, F: 1.0, L: 1.0, D: 1.0, N: 1.0 },  // Fire
  L: { W: 1.0, E: 1.0, A: 1.0, F: 1.0, L: 1.0, D: 2.0, N: 1.0 },  // Light
  D: { W: 1.0, E: 1.0, A: 1.0, F: 1.0, L: 2.0, D: 1.0, N: 1.0 },  // Dark
  N: { W: 1.0, E: 1.0, A: 1.0, F: 1.0, L: 1.0, D: 1.0, N: 1.0 },  // Non-elemental (always neutral)
};

/**
 * Get the damage multiplier when attacking element A hits target element B.
 * If targetElement is undefined, defaults to 'N' (non-elemental, no multiplier).
 */
export function getElementalMultiplier(attackElement: Element, targetElement?: Element): number {
  const target = targetElement ?? 'N';
  return ELEMENTAL_MATRIX[attackElement]?.[target] ?? 1.0;
}
