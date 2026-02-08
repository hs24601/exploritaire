import type { NodeEdgePattern } from './types';

/**
 * Pattern Templates Library
 *
 * Each pattern defines:
 * - Node positions in 3D space (x, y, z)
 * - Card count per node (depth of stack)
 * - Blocking relationships (which nodes block which)
 *
 * Coordinate system:
 * - (0, 0) is the center of the canvas
 * - x: horizontal (-left, +right)
 * - y: vertical (-up, +down)
 * - z: layering (higher values appear on top)
 */

export const NODE_PATTERNS: Record<string, NodeEdgePattern> = {
  pyramid: {
    id: 'pyramid',
    name: 'The Pyramid',
    description: 'A classic pyramid structure',
    totalCards: 28,
    nodes: [
      // Layer 0 (base) - 7 nodes, 1 card each, no blockers
      { id: 'p0_0', position: { x: -240, y: 100, z: 0 }, cardCount: 1, blockedBy: [] },
      { id: 'p0_1', position: { x: -160, y: 100, z: 0 }, cardCount: 1, blockedBy: [] },
      { id: 'p0_2', position: { x: -80, y: 100, z: 0 }, cardCount: 1, blockedBy: [] },
      { id: 'p0_3', position: { x: 0, y: 100, z: 0 }, cardCount: 1, blockedBy: [] },
      { id: 'p0_4', position: { x: 80, y: 100, z: 0 }, cardCount: 1, blockedBy: [] },
      { id: 'p0_5', position: { x: 160, y: 100, z: 0 }, cardCount: 1, blockedBy: [] },
      { id: 'p0_6', position: { x: 240, y: 100, z: 0 }, cardCount: 1, blockedBy: [] },

      // Layer 1 - 6 nodes, 1 card each, blocked by pairs from layer below
      { id: 'p1_0', position: { x: -200, y: 40, z: 1 }, cardCount: 1, blockedBy: ['p0_0', 'p0_1'] },
      { id: 'p1_1', position: { x: -120, y: 40, z: 1 }, cardCount: 1, blockedBy: ['p0_1', 'p0_2'] },
      { id: 'p1_2', position: { x: -40, y: 40, z: 1 }, cardCount: 1, blockedBy: ['p0_2', 'p0_3'] },
      { id: 'p1_3', position: { x: 40, y: 40, z: 1 }, cardCount: 1, blockedBy: ['p0_3', 'p0_4'] },
      { id: 'p1_4', position: { x: 120, y: 40, z: 1 }, cardCount: 1, blockedBy: ['p0_4', 'p0_5'] },
      { id: 'p1_5', position: { x: 200, y: 40, z: 1 }, cardCount: 1, blockedBy: ['p0_5', 'p0_6'] },

      // Layer 2 - 5 nodes, 1 card each
      { id: 'p2_0', position: { x: -160, y: -20, z: 2 }, cardCount: 1, blockedBy: ['p1_0', 'p1_1'] },
      { id: 'p2_1', position: { x: -80, y: -20, z: 2 }, cardCount: 1, blockedBy: ['p1_1', 'p1_2'] },
      { id: 'p2_2', position: { x: 0, y: -20, z: 2 }, cardCount: 1, blockedBy: ['p1_2', 'p1_3'] },
      { id: 'p2_3', position: { x: 80, y: -20, z: 2 }, cardCount: 1, blockedBy: ['p1_3', 'p1_4'] },
      { id: 'p2_4', position: { x: 160, y: -20, z: 2 }, cardCount: 1, blockedBy: ['p1_4', 'p1_5'] },

      // Layer 3 - 4 nodes
      { id: 'p3_0', position: { x: -120, y: -80, z: 3 }, cardCount: 1, blockedBy: ['p2_0', 'p2_1'] },
      { id: 'p3_1', position: { x: -40, y: -80, z: 3 }, cardCount: 1, blockedBy: ['p2_1', 'p2_2'] },
      { id: 'p3_2', position: { x: 40, y: -80, z: 3 }, cardCount: 1, blockedBy: ['p2_2', 'p2_3'] },
      { id: 'p3_3', position: { x: 120, y: -80, z: 3 }, cardCount: 1, blockedBy: ['p2_3', 'p2_4'] },

      // Layer 4 - 3 nodes
      { id: 'p4_0', position: { x: -80, y: -140, z: 4 }, cardCount: 1, blockedBy: ['p3_0', 'p3_1'] },
      { id: 'p4_1', position: { x: 0, y: -140, z: 4 }, cardCount: 1, blockedBy: ['p3_1', 'p3_2'] },
      { id: 'p4_2', position: { x: 80, y: -140, z: 4 }, cardCount: 1, blockedBy: ['p3_2', 'p3_3'] },

      // Layer 5 - 2 nodes
      { id: 'p5_0', position: { x: -40, y: -200, z: 5 }, cardCount: 1, blockedBy: ['p4_0', 'p4_1'] },
      { id: 'p5_1', position: { x: 40, y: -200, z: 5 }, cardCount: 1, blockedBy: ['p4_1', 'p4_2'] },

      // Layer 6 (top) - 1 node
      { id: 'p6_0', position: { x: 0, y: -260, z: 6 }, cardCount: 1, blockedBy: ['p5_0', 'p5_1'] },
    ],
  },

  cross: {
    id: 'cross',
    name: 'The Cross',
    description: 'Cards arranged in a cross pattern',
    totalCards: 21,
    nodes: [
      // Center: 5 cards deep, highest z-index
      { id: 'c_center', position: { x: 0, y: 0, z: 2 }, cardCount: 5, blockedBy: [] },

      // Arms: 2 cards each, block center
      { id: 'c_north', position: { x: 0, y: -120, z: 1 }, cardCount: 2, blockedBy: ['c_center'] },
      { id: 'c_south', position: { x: 0, y: 120, z: 1 }, cardCount: 2, blockedBy: ['c_center'] },
      { id: 'c_east', position: { x: 120, y: 0, z: 1 }, cardCount: 2, blockedBy: ['c_center'] },
      { id: 'c_west', position: { x: -120, y: 0, z: 1 }, cardCount: 2, blockedBy: ['c_center'] },

      // Tips: 2 cards each, block their respective arms
      { id: 'c_n_tip', position: { x: 0, y: -200, z: 0 }, cardCount: 2, blockedBy: ['c_north'] },
      { id: 'c_s_tip', position: { x: 0, y: 200, z: 0 }, cardCount: 2, blockedBy: ['c_south'] },
      { id: 'c_e_tip', position: { x: 200, y: 0, z: 0 }, cardCount: 2, blockedBy: ['c_east'] },
      { id: 'c_w_tip', position: { x: -200, y: 0, z: 0 }, cardCount: 2, blockedBy: ['c_west'] },
    ],
  },

  thicket: {
    id: 'thicket',
    name: 'The Thicket',
    description: 'A dense tangle of branching paths',
    totalCards: 12,
    nodes: [
      // Top row - 2 cards, accessible first (no blockers)
      { id: 't_t_l', position: { x: -80, y: -100, z: 0 }, cardCount: 1, blockedBy: [] },
      { id: 't_t_r', position: { x: 80, y: -100, z: 0 }, cardCount: 1, blockedBy: [] },

      // Upper middle - 3 cards, blocked by top
      { id: 't_um_l', position: { x: -120, y: -30, z: 1 }, cardCount: 1, blockedBy: ['t_t_l'] },
      { id: 't_um_c', position: { x: 0, y: -30, z: 1 }, cardCount: 1, blockedBy: ['t_t_l', 't_t_r'] },
      { id: 't_um_r', position: { x: 120, y: -30, z: 1 }, cardCount: 1, blockedBy: ['t_t_r'] },

      // Middle layer - 2 stacks with 2 cards each (dense core)
      { id: 't_m_l', position: { x: -60, y: 40, z: 2 }, cardCount: 2, blockedBy: ['t_um_l', 't_um_c'] },
      { id: 't_m_r', position: { x: 60, y: 40, z: 2 }, cardCount: 2, blockedBy: ['t_um_c', 't_um_r'] },

      // Bottom layer - 3 cards, blocked by middle
      { id: 't_b_l', position: { x: -90, y: 100, z: 3 }, cardCount: 1, blockedBy: ['t_m_l'] },
      { id: 't_b_c', position: { x: 0, y: 100, z: 3 }, cardCount: 1, blockedBy: ['t_m_l', 't_m_r'] },
      { id: 't_b_r', position: { x: 90, y: 100, z: 3 }, cardCount: 1, blockedBy: ['t_m_r'] },
    ],
  },
};

/**
 * Gets a node pattern by ID
 */
export function getNodePattern(patternId: string): NodeEdgePattern | null {
  return NODE_PATTERNS[patternId] || null;
}
