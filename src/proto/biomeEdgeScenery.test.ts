import { describe, expect, it } from 'vitest';
import { EDGE_PROP_MIN_HEIGHT, LABEL_CLEARANCE, labelInCamera, layoutEdgeScenery, layoutEdgeSceneryForView, layoutTableScenery, maxHeightClearOfLabel, popupSizeClearOfLabels, turnPoint, type EdgeScenery, type LabelBox, type SceneryTile } from './biomeEdgeScenery';
import { projectTilt, tableCameraTilt } from './tableTilt';
import { projectAtmospherePoint } from './volumetricAtmosphere';

const scenery: EdgeScenery = { side: { src: 'side.png', width: 14, height: 27 }, front: { src: 'front.png', width: 12, height: 9 } };
const tile = { width: 48, height: 48 };
const TILT = 38;
const cos = Math.cos((TILT * Math.PI) / 180);

/** Does an upright prop cover the flat label on screen (orthographic)? */
const covers = (prop: { x: number; y: number; width: number; height: number }, label: LabelBox) => {
  const columns = prop.x + prop.width / 2 > label.left && prop.x - prop.width / 2 < label.right;
  const rows = prop.y * cos > label.top * cos && prop.y * cos - prop.height < label.bottom * cos;
  return columns && rows;
};

describe('biome edge scenery', () => {
  const short: LabelBox = { left: -14, right: 14, top: -6, bottom: 5 }; // "POND"
  const tall: LabelBox = { left: -18, right: 18, top: -14, bottom: 17 }; // "SMALL WOODS" on two lines

  it('lines both sides from back to front and the front edge', () => {
    const props = layoutEdgeScenery(tile, scenery, short, TILT);
    expect(props.filter((p) => p.edge === 'left')).toHaveLength(3);
    expect(props.filter((p) => p.edge === 'right')).toHaveLength(3);
    expect(props.filter((p) => p.edge === 'front').length).toBeGreaterThanOrEqual(3);
    const left = props.filter((p) => p.edge === 'left');
    expect(left[0].height).toBeGreaterThan(left[2].height);
    expect(Math.min(...props.filter((p) => p.edge === 'front').map((p) => p.height))).toBeLessThan(left[2].height);
  });

  it('never covers the label, short or tall', () => {
    for (const label of [short, tall]) {
      for (const prop of layoutEdgeScenery(tile, scenery, label, TILT)) expect(covers(prop, label), prop.id).toBe(false);
    }
  });

  it('cuts front props down in front of the label and drops ones too short to read', () => {
    const front = layoutEdgeScenery(tile, scenery, short, TILT).filter((p) => p.edge === 'front');
    const middle = front.filter((p) => Math.abs(p.x) < 14);
    expect(middle.length).toBeGreaterThan(0);
    for (const prop of middle) expect(prop.height).toBeLessThanOrEqual(maxHeightClearOfLabel(prop.y, short, TILT) + 1e-9);
    const tallFront = layoutEdgeScenery(tile, scenery, tall, TILT).filter((p) => p.edge === 'front');
    for (const prop of tallFront) expect(prop.height).toBeGreaterThanOrEqual(EDGE_PROP_MIN_HEIGHT);
    expect(tallFront.every((p) => Math.abs(p.x) > 18)).toBe(true);
  });

  it('keeps everything clear of the whole tile until the label is measured', () => {
    const props = layoutEdgeScenery(tile, scenery, null, TILT);
    expect(props.every((p) => p.edge !== 'front' || Math.abs(p.x) - p.width / 2 >= 24)).toBe(true);
    for (const p of props.filter((p) => p.edge !== 'front' && p.y > -24)) expect(Math.abs(p.x) - p.width / 2).toBeGreaterThanOrEqual(24);
  });

  it('lines the sides facing a spun camera and never covers the upright label', () => {
    for (const yaw of [0, 20, 45, -45, 70, 90, 135, 180, 225, 300]) {
      // As measured on the board: the label's frame sits off the tile's centre.
      const offCentre: LabelBox = { left: -19, right: 11, top: -17, bottom: 12, pivot: { x: -3, y: -3.5 } };
      for (const label of [short, tall, offCentre]) {
        const props = layoutEdgeSceneryForView(tile, scenery, label, TILT, yaw);
        // In the camera's frame (world turned by the spin) the label is upright,
        // moved by its pivot's turn.
        const pivot = label.pivot ?? { x: 0, y: 0 }, turned = turnPoint(pivot, yaw);
        const seen = { left: label.left + turned.x - pivot.x, right: label.right + turned.x - pivot.x, top: label.top + turned.y - pivot.y, bottom: label.bottom + turned.y - pivot.y };
        for (const prop of props) expect(covers({ ...prop, ...turnPoint(prop, yaw) }, seen), `${yaw}° ${prop.id}`).toBe(false);
        // The front row sits on the tile side nearest the camera.
        const front = props.filter((prop) => prop.edge === 'front').map((prop) => turnPoint(prop, yaw).y);
        expect(front.reduce((sum, y) => sum + y, 0) / front.length, `${yaw}°`).toBeGreaterThan(10);
      }
    }
  });
});

describe('uniform pop-up fitting', () => {
  const label: LabelBox = { left: -14, right: 14, top: -10, bottom: 9 };
  const tiles: SceneryTile[] = [
    { id: 'woods-east', centre: { x: 48, y: -48 }, size: tile, terrain: 'woods', scenery, label },
    { id: 'woods-danger', centre: { x: 96, y: 48 }, size: tile, terrain: 'woods', scenery, label },
  ];
  const foot = { x: 96, y: 48 - 48 * 0.37 };

  it('keeps the Dark Woods centre pop-up readable through camera descent', () => {
    for (const angle of [60, 62.1, 71, 78, 82]) {
      const size = popupSizeClearOfLabels(foot, 72, tiles, angle, 0, 'woods-danger');
      expect(size).toBe(62);
      expect(foot.x - size / 2).toBeGreaterThanOrEqual(48 + label.right + LABEL_CLEARANCE);
    }
  });

  it('fits the largest safe square beside or below every label, at any spin', () => {
    for (const angle of [38, 60, 71, 82]) for (const yaw of [0, 20, 45, 90, 135, 180, 270]) {
      const size = popupSizeClearOfLabels(foot, 72, tiles, angle, yaw, 'woods-danger');
      expect(size).toBeGreaterThanOrEqual(0);
      expect(size).toBeLessThanOrEqual(72);
      for (const other of tiles.filter(item => item.id !== 'woods-danger')) {
        const seen = labelInCamera(label, yaw);
        const local = turnPoint({ x: foot.x - other.centre.x, y: foot.y - other.centre.y }, yaw);
        const behind = local.y <= seen.top;
        const beside = local.x + size / 2 <= seen.left - LABEL_CLEARANCE + 1e-9
          || local.x - size / 2 >= seen.right + LABEL_CLEARANCE - 1e-9;
        const below = size <= maxHeightClearOfLabel(local.y, seen, angle) + 1e-9;
        expect(behind || beside || below || size === 0, `${angle}° ${yaw}°`).toBe(true);
      }
    }
  });

  it('retains full size behind a label and when there is no neighbouring label', () => {
    expect(popupSizeClearOfLabels({ x: 48, y: -70 }, 72, tiles.slice(0, 1), 82, 0)).toBe(72);
    expect(popupSizeClearOfLabels(foot, 72, tiles.slice(1), 82, 0, 'woods-danger')).toBe(72);
  });

  it('uses vertical clearance when a pop-up is directly in front of the text', () => {
    const directlyAhead = { x: 48, y: 0 };
    expect(popupSizeClearOfLabels(directlyAhead, 72, tiles.slice(0, 1), 60, 0))
      .toBeCloseTo(maxHeightClearOfLabel(48, label, 60));
  });

  it('keeps the centre pop-up readable and clear of projected labels after panning and zooming', () => {
    for (const viewportHeight of [500, 700]) for (const scale of [4.5, 4.981, 5.644, 6.8]) {
      const camera = { x: -96 * scale, y: -48 * scale, scale, yaw: 0 };
      const tilt = tableCameraTilt(viewportHeight, scale);
      const size = popupSizeClearOfLabels(foot, 72, tiles, tilt.angle, 0, 'woods-danger', { camera, tilt });
      expect(size).toBeGreaterThan(26);
      // Verify against the independent billboard projection used by atmosphere,
      // rather than just asserting the dimensions returned by the fitter.
      const bottom = projectAtmospherePoint(foot, 0, camera, tilt);
      const top = projectAtmospherePoint(foot, size, camera, tilt);
      const halfWidth = (bottom.y - top.y) / 2;
      const other = tiles[0];
      const corners = [[label.left, label.top], [label.right, label.top], [label.right, label.bottom], [label.left, label.bottom]]
        .map(([x, y]) => projectTilt({ x: (other.centre.x + x) * scale + camera.x, y: (other.centre.y + y) * scale + camera.y }, tilt));
      const left = Math.min(...corners.map(point => point.x)), right = Math.max(...corners.map(point => point.x));
      const labelTop = Math.min(...corners.map(point => point.y)), labelBottom = Math.max(...corners.map(point => point.y));
      expect(bottom.x + halfWidth <= left || bottom.x - halfWidth >= right || bottom.y <= labelTop || top.y >= labelBottom).toBe(true);
    }
  });
});

describe('scenery across neighbouring tiles', () => {
  const pond: EdgeScenery = { side: { src: 'reeds-side', width: 14, height: 27 }, front: { src: 'reeds-front', width: 12, height: 9 } };
  const woods: EdgeScenery = { side: { src: 'pines-side', width: 15, height: 26 }, front: { src: 'ferns', width: 12, height: 8 } };
  const label: LabelBox = { left: -14.5, right: 14.5, top: -10, bottom: 9, pivot: { x: 0, y: -0.5 } };
  // The starting row: pond, Small Woods, Small Woods.
  const row: SceneryTile[] = [
    { id: 'pond', centre: { x: -48, y: -48 }, size: tile, terrain: 'water', scenery: pond, label },
    { id: 'woods-alpha', centre: { x: 0, y: -48 }, size: tile, terrain: 'woods', scenery: woods, label },
    { id: 'woods-east', centre: { x: 48, y: -48 }, size: tile, terrain: 'woods', scenery: woods, label },
  ];
  const world = (owner: string, prop: { x: number; y: number }) => { const t = row.find((entry) => entry.id === owner)!; return { x: t.centre.x + prop.x, y: t.centre.y + prop.y }; };

  it('merges a shared edge into one run and mixes different terrains', () => {
    const props = layoutTableScenery(row, TILT, 0);
    // No prop of either woods stands on their shared edge at x = 24 except the seam run.
    const onSeam = (x: number) => Object.entries(props).flatMap(([owner, list]) => list.map((prop) => ({ owner, prop, at: world(owner, prop) }))).filter(({ at }) => Math.abs(at.x - x) < 6);
    // Front-row tufts meet at the seam's corner; the rest is the seam run.
    const woodsSeam = onSeam(24).filter(({ prop }) => prop.edge !== 'front');
    expect(woodsSeam.length).toBeGreaterThan(0);
    expect(woodsSeam.every(({ prop }) => prop.id.startsWith('seam-'))).toBe(true);
    expect(new Set(woodsSeam.map(({ prop }) => prop.src))).toEqual(new Set(['pines-side']));
    // Pond and woods share x = -24: reeds and pines alternate along it.
    const mixedSeam = onSeam(-24).filter(({ prop }) => prop.edge !== 'front');
    expect(new Set(mixedSeam.map(({ prop }) => prop.src))).toEqual(new Set(['reeds-side', 'pines-side']));
    // The ends of the row keep their own outer sides.
    expect(props.pond.some((prop) => prop.edge === 'left' && !prop.id.startsWith('seam-'))).toBe(true);
    expect(props['woods-east'].some((prop) => prop.edge === 'right' && !prop.id.startsWith('seam-'))).toBe(true);
  });

  it('keeps every prop off every label at any spin', () => {
    for (const yaw of [0, 30, 45, 90, 135, 180, 270]) {
      const props = layoutTableScenery(row, TILT, yaw);
      for (const [owner, list] of Object.entries(props)) for (const prop of list) {
        const at = world(owner, prop);
        for (const tile of row) {
          const seen = labelInCamera(label, yaw);
          const local = turnPoint({ x: at.x - tile.centre.x, y: at.y - tile.centre.y }, yaw);
          expect(covers({ ...prop, ...local }, seen), `${yaw}° ${owner} ${prop.id} over ${tile.id}`).toBe(false);
        }
      }
    }
  });

  it('runs a seam across the view as a short fringe when the row faces the camera end-on', () => {
    const props = layoutTableScenery(row, TILT, 90);
    const seam = Object.values(props).flat().filter((prop) => prop.id.startsWith('seam-'));
    expect(seam.length).toBeGreaterThan(0);
    expect(seam.every((prop) => prop.edge === 'front')).toBe(true);
  });
});
