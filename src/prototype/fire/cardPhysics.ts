export type TablePoint = { x: number; y: number };
export type TableBody = TablePoint & { id: string; halfWidth: number; halfHeight: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const overlaps = (a: TableBody, b: TableBody) => Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth && Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight;

function clampToTable(point: TablePoint, body: Pick<TableBody, 'halfWidth' | 'halfHeight'>): TablePoint {
  return { x: clamp(point.x, body.halfWidth, 100 - body.halfWidth), y: clamp(point.y, body.halfHeight, 100 - body.halfHeight) };
}

function isOpen(candidate: TableBody, blockers: TableBody[]) { return blockers.every((body) => !overlaps(candidate, body)); }

/**
 * Resolves only the body being placed. Existing bodies are immutable blockers,
 * so a drag/drop never nudges cards that were already on the table. A bounded
 * local search provides a deterministic escape route instead of sticky piles.
 */
export function resolveDroppedCard(moving: TableBody, blockers: TableBody[]): TablePoint {
  let candidate: TableBody = { ...moving, ...clampToTable(moving, moving) };
  for (let pass = 0; pass < 16; pass += 1) {
    const blocker = blockers.find((body) => overlaps(candidate, body));
    if (!blocker) return { x: candidate.x, y: candidate.y };
    const overlapX = candidate.halfWidth + blocker.halfWidth - Math.abs(candidate.x - blocker.x);
    const overlapY = candidate.halfHeight + blocker.halfHeight - Math.abs(candidate.y - blocker.y);
    if (overlapX <= overlapY) {
      const direction = candidate.x === blocker.x ? (candidate.y >= blocker.y ? 1 : -1) : Math.sign(candidate.x - blocker.x);
      candidate.x += direction * (overlapX + .15);
    } else {
      const direction = candidate.y === blocker.y ? 1 : Math.sign(candidate.y - blocker.y);
      candidate.y += direction * (overlapY + .15);
    }
    candidate = { ...candidate, ...clampToTable(candidate, candidate) };
  }
  // Dense corners can block the direct push. Search expanding rings around the
  // release point; this terminates quickly and keeps the moved card nearby.
  for (let radius = 1; radius <= 36; radius += 1) {
    for (let step = 0; step < 16; step += 1) {
      const angle = step / 16 * Math.PI * 2;
      const point = clampToTable({ x: moving.x + Math.cos(angle) * radius, y: moving.y + Math.sin(angle) * radius }, moving);
      const probe = { ...moving, ...point };
      if (isOpen(probe, blockers)) return point;
    }
  }
  // If there is genuinely no room, retain the last clamped point rather than
  // moving a static card or entering an unbounded collision loop.
  return { x: candidate.x, y: candidate.y };
}
