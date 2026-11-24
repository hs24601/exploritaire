import { describe, expect, it } from 'vitest';
import { actorPeekHole, localPeekHole, peekMaskLayers, projectSceneryPoint, sceneryArtProjection, sceneryLocalPoint } from './actorPeek';
import { projectBillboard } from './actorOcclusion';
import { tableCameraTilt } from './tableTilt';

describe('immersive actor peek openings', () => {
  it('round-trips artwork points through live perspective for billboards and fixed planes', () => {
    for (const scale of [1.7, 4.5, 6.8]) for (const yaw of [0, 45, 135, 180, 270]) for (const worldHeading of [undefined, .4, 1.8]) {
      const face = { x: -36, y: 62, width: 48, height: 60, worldHeading }, camera = { x: 25, y: -70, scale, yaw };
      const tilt = tableCameraTilt(720, scale);
      for (const point of [{ x: -12, y: -15 }, { x: 24, y: 60 }, { x: 57, y: 28 }]) {
        const local = sceneryLocalPoint(face, projectSceneryPoint(face, point, camera, tilt), camera, tilt)!;
        expect(local.x).toBeCloseTo(point.x, 6); expect(local.y).toBeCloseTo(point.y, 6);
      }
    }
  });
  it('clears the whole actor inside the ragged edge at each zoom and heading', () => {
    for (const scale of [1.7, 3.1, 6.8]) for (const yaw of [0, 90, 180, 270]) {
      const camera = { x: 0, y: -48, scale, yaw }, tilt = tableCameraTilt(720, scale);
      const actor = projectBillboard({ x: 0, y: 48, width: 32 * 1.7 / scale, height: 32 * 1.7 / scale }, camera, tilt);
      const hole = actorPeekHole(actor);
      const cornerDistance = ((actor.right - hole.x) / hole.rx) ** 2 + ((actor.bottom - hole.y) / hole.ry) ** 2;
      expect(cornerDistance).toBeLessThan(.82 ** 2);
      const prop = { x: 0, y: 62, width: 48, height: 60 };
      const local = localPeekHole(prop, hole, camera, tilt)!;
      const projected = projectSceneryPoint(prop, local, camera, tilt);
      expect(projected.x).toBeCloseTo(hole.x, 6); expect(projected.y).toBeCloseTo(hole.y, 6);
    }
  });
  it('includes relief artwork extending outside the nominal prop box', () => {
    const face = { x: 0, y: 60, width: 48, height: 48 }, camera = { x: 0, y: 0, scale: 1.7 };
    const tilt = tableCameraTilt(720, camera.scale), nominal = projectBillboard(face, camera, tilt);
    const art = sceneryArtProjection(face, { x: -12, y: -10, width: 72, height: 90 }, camera, tilt);
    expect(art.left).toBeLessThan(nominal.left); expect(art.top).toBeLessThan(nominal.top);
    expect(art.right).toBeGreaterThan(nominal.right); expect(art.bottom).toBeGreaterThan(nominal.bottom);
    expect(art.depth).toEqual(nominal.depth);
  });
  it('rejects edge-on fixed planes instead of producing an unbounded mask', () => {
    const camera = { x: 0, y: 0, scale: 1.7, yaw: 90 }, tilt = tableCameraTilt(720, 1.7);
    expect(sceneryLocalPoint({ x: 0, y: 0, width: 48, height: 48, worldHeading: 0 }, { x: 0, y: -30 }, camera, tilt)).toBeNull();
  });
  it('composites overlapping actor holes as a union and reuses one texture', () => {
    const holes = [{ x: 20, y: 30, rx: 18, ry: 24 }, { x: 30, y: 30, rx: 18, ry: 24 }];
    const mask = peekMaskLayers(holes, { x: -10, y: -5, width: 72, height: 90 });
    expect(mask.composite).toBe('subtract,add,add');
    expect(mask.image.match(/data:image\/svg\+xml/g)).toHaveLength(2);
    const images = mask.image.match(/url\("[^"]+"\)/g)!;
    expect(images[0]).toEqual(images[1]);
  });
});

it('keeps relative mask coordinates aligned through oversampling and lens magnification',()=>{
  const box={x:-18,y:-32,width:58.5,height:97},hole={x:19,y:14,rx:7,ry:9};
  const mask=peekMaskLayers([hole],box,true);
  const [w,h]=mask.size.split(',')[1].trim().split(' ').map(parseFloat);
  const [x,y]=mask.position.split(',')[1].trim().split(' ').map(parseFloat);
  for(const zoom of [1,6,18]) {
    const width=box.width*zoom,height=box.height*zoom,mw=width*w/100,mh=height*h/100;
    expect((width-mw)*x/100+mw/2).toBeCloseTo((hole.x-box.x)*zoom,6);
    expect((height-mh)*y/100+mh/2).toBeCloseTo((hole.y-box.y)*zoom,6);
  }
});
