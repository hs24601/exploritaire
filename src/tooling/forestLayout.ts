export type ForestTree = { x: number; z: number; height: number; yaw: number; distance: number };
export const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Move a billboard only when necessary to keep its local view inside the cone.
 * Carries the previous heading, avoiding a seam jump behind the source view. */
export function boundedBillboardYaw(view: number, previous: number, limit = Math.PI / 6) {
  const delta = wrapAngle(view - previous);
  return previous + delta - Math.max(-limit, Math.min(limit, delta));
}

export function forestLayout(count = 120, seed = 2701): ForestTree[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const trees: ForestTree[] = [];
  for (let attempt = 0; trees.length < count && attempt < 12000; attempt++) {
    const x = (random() * 2 - 1) * 35, z = (random() * 2 - 1) * 35;
    if (x * x + z * z > 35 * 35) continue;
    // A quiet starting lane gives readable ground-level entry into the grove.
    if (Math.abs(x - Math.sin(z * .12) * 2) < 2 && z > -17 && z < 23) continue;
    if (trees.some(tree => Math.hypot(tree.x - x, tree.z - z) < 2.6)) continue;
    const height = 6 + random() * 5;
    trees.push({ x, z, height, yaw: Math.atan2(-x, 16 - z), distance: 0 });
  }
  return trees;
}
