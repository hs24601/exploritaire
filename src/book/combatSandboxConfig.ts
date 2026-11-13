/** Stable sandbox index, separate from campaign page numbers and saved story IDs. */
export const BOOK_SANDBOXES = {
  combat: { id: 'combat-01', query: 'combatsbx', href: 'book.html?combatsbx', name: 'Combat sandbox' },
} as const;
export const ARENA_BOUNDS = { minX: -5.55, maxX: 5.55, minZ: -3.4, maxZ: 3.4 };
export function arenaTrees() {
  const trees: { x: number; z: number; height: number; edge: string }[] = [];
  for (const edge of ['back', 'front', 'left', 'right']) {
    const across = edge === 'back' || edge === 'front', count = across ? 19 : 10;
    for (let i = 0; i < count; i++) {
      const t = across ? i / (count - 1) : (i + 1) / (count + 1);
      trees.push({ x: across ? -5.55 + t * 11.1 : edge === 'left' ? -5.55 : 5.55,
        z: across ? edge === 'back' ? -3.4 : 3.4 : -3.4 + t * 6.8,
        height: (edge === 'front' ? 1.05 : edge === 'back' ? 2.65 : 1.8) * (1 + .12 * Math.sin(i * 2.7)), edge });
    }
  }
  return trees;
}
