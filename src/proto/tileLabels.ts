import { TABLE_GRID } from './gridCoordinates';

type LabelTile = {
  id: string; title: string; tileType?: string; flags?: readonly string[];
  terrain?: string; road?: unknown;
  position: { x: number; y: number }; gridSize: { columns: number; rows: number };
};

/** Only permanently fixed terrain shares physical artwork and scenery bounds.
 * Label sharing is independent and also applies to discovered mutable biomes. */
export const IMMUTABLE_TILE_TYPES = new Set(['impassable-mountain']);

/** Connected art may have a notched boundary; its print clips to member cells. */
export function immutableTerrainRegions<T extends LabelTile>(tiles: readonly T[]) {
  const pending = new Set(tiles.filter(tile => IMMUTABLE_TILE_TYPES.has(tile.tileType ?? '') && !tile.flags?.includes('unexplored') && tile.gridSize.columns === 1 && tile.gridSize.rows === 1));
  const regions: { id: string; title: string; tiles: T[]; x: number; y: number; width: number; height: number }[] = [];
  while (pending.size) {
    const first = pending.values().next().value!;
    pending.delete(first);
    const members = [first];
    for (let i = 0; i < members.length; i++) {
      const cell = TABLE_GRID.atWorld(members[i].position);
      for (const candidate of pending) {
        const other = TABLE_GRID.atWorld(candidate.position);
        if (candidate.tileType === first.tileType && candidate.title === first.title && Math.abs(cell.column - other.column) + Math.abs(cell.row - other.row) === 1) {
          members.push(candidate); pending.delete(candidate);
        }
      }
    }
    const cells = members.map(tile => TABLE_GRID.atWorld(tile.position));
    const left = Math.min(...cells.map(cell => cell.column)), top = Math.min(...cells.map(cell => cell.row));
    const columns = Math.max(...cells.map(cell => cell.column)) - left + 1;
    const rows = Math.max(...cells.map(cell => cell.row)) - top + 1;
    const bounds = TABLE_GRID.region(TABLE_GRID.cell(left, top), columns, rows);
    regions.push({ id: members.map(tile => tile.id).sort().join('+'), title: first.title, tiles: members, ...bounds });
  }
  return regions;
}

/** Partition into filled rectangles so titles and scenery feet never bridge
 * a den, a hole or another terrain type inside a connected range. */
export function immutableTileRegions<T extends LabelTile>(tiles: readonly T[]) {
  return immutableTerrainRegions(tiles).flatMap(region => {
    const rows = new Map<number, T[]>();
    for (const tile of region.tiles) {
      const row = TABLE_GRID.atWorld(tile.position).row;
      rows.set(row, [...(rows.get(row) ?? []), tile]);
    }
    const groups: { left: number; right: number; bottom: number; tiles: T[] }[] = [];
    for (const [row, members] of [...rows].sort(([a], [b]) => a - b)) {
      const sorted = members.sort((a, b) => a.position.x - b.position.x);
      for (let start = 0; start < sorted.length;) {
        let end = start + 1;
        while (end < sorted.length && sorted[end].position.x - sorted[end - 1].position.x === TABLE_GRID.cellSize) end++;
        const run = sorted.slice(start, end);
        const left = TABLE_GRID.atWorld(run[0].position).column, right = TABLE_GRID.atWorld(run[run.length - 1].position).column;
        const above = groups.find(group => group.bottom === row - 1 && group.left === left && group.right === right);
        if (above) { above.tiles.push(...run); above.bottom = row; }
        else groups.push({ left, right, bottom: row, tiles: run });
        start = end;
      }
    }
    return groups.map(group => {
      const top = Math.min(...group.tiles.map(tile => TABLE_GRID.atWorld(tile.position).row));
      const bounds = TABLE_GRID.region(TABLE_GRID.cell(group.left, top), group.right - group.left + 1, group.bottom - top + 1);
      return { id: group.tiles.map(tile => tile.id).sort().join('+'), title: region.title, tiles: group.tiles, ...bounds };
    });
  });
}

const tileCells = (tile: LabelTile) => {
  const anchor = TABLE_GRID.atWorld(tile.position);
  const first = TABLE_GRID.offset(anchor, -Math.floor(tile.gridSize.columns / 2), -Math.floor(tile.gridSize.rows / 2));
  return Array.from({ length: tile.gridSize.columns * tile.gridSize.rows }, (_, index) =>
    TABLE_GRID.offset(first, index % tile.gridSize.columns, Math.floor(index / tile.gridSize.columns)));
};
const cellKey = (column: number, row: number) => `${column},${row}`;
const labelType = (tile: LabelTile) => JSON.stringify([tile.road ? 'road' : tile.tileType ?? tile.terrain ?? 'woods', tile.title]);

/** One label per edge-connected, discovered group of the same named type.
 * Its largest filled rectangle gives the title room without bridging holes,
 * fog or other tile types. Physical tiles, artwork and actions stay separate. */
export function connectedTileLabelRegions<T extends LabelTile>(tiles: readonly T[]) {
  const visible = tiles.filter(tile => !tile.flags?.includes('unexplored')).sort((a, b) => a.id.localeCompare(b.id));
  const footprints = new Map(visible.map(tile => [tile, tileCells(tile)]));
  const owners = new Map(visible.flatMap(tile => footprints.get(tile)!.map(cell => [cellKey(cell.column, cell.row), tile] as const)));
  const pending = new Set(visible);
  const regions: { id: string; title: string; tiles: T[]; x: number; y: number; width: number; height: number }[] = [];
  while (pending.size) {
    const first = pending.values().next().value!;
    const type = labelType(first);
    const members = [first];
    pending.delete(first);
    for (let index = 0; index < members.length; index++) {
      for (const cell of footprints.get(members[index])!) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const neighbour = owners.get(cellKey(cell.column + dx, cell.row + dy));
        if (neighbour && pending.has(neighbour) && labelType(neighbour) === type) {
          pending.delete(neighbour);
          members.push(neighbour);
        }
      }
    }
    if (members.length < 2) continue;
    const cells = members.flatMap(tile => footprints.get(tile)!);
    const occupied = new Set(cells.map(cell => cellKey(cell.column, cell.row)));
    const left = Math.min(...cells.map(cell => cell.column)), right = Math.max(...cells.map(cell => cell.column));
    const top = Math.min(...cells.map(cell => cell.row)), bottom = Math.max(...cells.map(cell => cell.row));
    let best = { column: left, row: top, columns: 1, rows: 1 };
    // Intersect every consecutive row band, retaining the widest filled run.
    // Equal areas prefer a wider label, then the earliest top/left position.
    for (let start = top; start <= bottom; start++) {
      const filled = Array<boolean>(right - left + 1).fill(true);
      for (let end = start; end <= bottom; end++) {
        let run = 0;
        for (let column = left; column <= right; column++) {
          filled[column - left] &&= occupied.has(cellKey(column, end));
          run = filled[column - left] ? run + 1 : 0;
          const rows = end - start + 1, area = run * rows, bestArea = best.columns * best.rows;
          if (area > bestArea || area === bestArea && run > best.columns) {
            best = { column: column - run + 1, row: start, columns: run, rows };
          }
        }
      }
    }
    const bounds = TABLE_GRID.region(TABLE_GRID.cell(best.column, best.row), best.columns, best.rows);
    regions.push({ id: members.map(tile => tile.id).sort().join('+'), title: first.title, tiles: members, ...bounds });
  }
  return regions;
}

export type TitleLine = { text: string; x: number; y: number; width: number };
export type TitleLayout = { fontSize: number; lineHeight: number; lines: TitleLine[]; fits: boolean };

/** An upright line must fit for its entire height inside the rotated footprint,
 * not merely inside its bounding box. This also works at arbitrary spin angles. */
export function titleBand(width: number, height: number, yaw: number, top: number, bottom: number) {
  const angle = yaw * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  let left = -Infinity, right = Infinity;
  for (const y of [top, bottom]) for (const [a, b, half] of [[c, s, width / 2], [-s, c, height / 2]]) {
    if (Math.abs(a) < 1e-8) { if (Math.abs(b * y) > half + 1e-6) return null; }
    else {
      const x1 = (-half - b * y) / a, x2 = (half - b * y) / a;
      left = Math.max(left, Math.min(x1, x2)); right = Math.min(right, Math.max(x1, x2));
    }
  }
  return right > left ? { left, right } : null;
}

export function fitTileTitle(text: string, width: number, height: number, yaw: number,
  measure: (text: string, size: number) => number, maximum = 18, minimum = 6, align: 'center' | 'top' | 'bottom' = 'center', maxLines = Infinity): TitleLayout {
  const title = text.trim().replace(/\s+/g, ' ');
  const radians = yaw * Math.PI / 180;
  const extent = Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height;
  // A smaller complete word is easier to read than oversized word fragments.
  // Only split a long word when no complete-word layout fits at the floor.
  for (const splitWords of [false, true]) for (let size = maximum; size >= minimum - 1e-6; size -= 0.25) {
    const lineHeight = size * 1.12;
    const maxRows = Math.min(maxLines, title.length, Math.floor(extent / lineHeight));
    for (let count = 1; count <= maxRows; count++) {
      let remaining = title;
      const lines: TitleLine[] = [];
      for (let row = 0; row < count && remaining; row++) {
        const y = (row - count / 2) * lineHeight;
        const band = titleBand(width, height, yaw, y, y + lineHeight);
        if (!band) break;
        const available = band.right - band.left;
        let length = 0;
        while (length < remaining.length && measure(remaining.slice(0, length + 1), size) <= available) length++;
        if (!length) break;
        // Prefer whole words; a long word can wrap rather than lose letters.
        if (length < remaining.length && remaining[length] !== ' ') {
          const space = remaining.lastIndexOf(' ', length);
          if (space > 0) length = space;
          else if (!splitWords) break;
        }
        const value = remaining.slice(0, length).trimEnd();
        lines.push({ text: value, x: (band.left + band.right) / 2, y, width: available });
        remaining = remaining.slice(length).trimStart();
      }
      if (!remaining) {
        if (align !== 'center') {
          // Slide the complete upright title toward the requested screen edge,
          // stopping when its ink reaches the padded, rotated footprint.
          const c = Math.cos(radians), s = Math.sin(radians);
          let offset = align === 'top' ? -Infinity : Infinity;
          for (const line of lines) {
            const inkWidth = measure(line.text, size);
            for (const x of [line.x - inkWidth / 2, line.x + inkWidth / 2]) {
              for (const y of [line.y, line.y + lineHeight]) {
                for (const [position, direction, half] of [[c * x + s * y, s, width / 2], [-s * x + c * y, c, height / 2]]) {
                  if (Math.abs(direction) > 1e-8) {
                    const a = (-half - position) / direction, b = (half - position) / direction;
                    offset = align === 'top' ? Math.max(offset, Math.min(a, b)) : Math.min(offset, Math.max(a, b));
                  }
                }
              }
            }
            // The line's hitless box follows its ink rather than extending
            // across the wider centred band after the shift.
            line.width = inkWidth;
          }
          for (const line of lines) line.y += align === 'top' ? Math.min(0, offset) : Math.max(0, offset);
        }
        return { fontSize: size, lineHeight, lines, fits: true };
      }
    }
  }
  return { fontSize: minimum, lineHeight: minimum * 1.12, lines: [], fits: false };
}
