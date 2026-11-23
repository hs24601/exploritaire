import {it,expect} from 'vitest';
import {seeded} from '../book/castlePaint';
import {createFlurryFaceRig,FLURRY_FACE_IDS,flurryFaceUV} from './flurryExpressions';
it('covers kin moods, directions, and registered blink/wink frames without atlas overlap',()=>{
 for(const name of ['neutral','curious','happy','sad','blink-half','blink-closed','look-left','look-right','look-up','look-down'])expect(FLURRY_FACE_IDS).toContain(name);
 expect(FLURRY_FACE_IDS).toHaveLength(20);const cells=FLURRY_FACE_IDS.map(id=>flurryFaceUV(id));expect(new Set(cells.map(cell=>`${cell.x},${cell.y}`)).size).toBe(20);
 for(const cell of cells){expect(cell.x).toBeGreaterThanOrEqual(0);expect(cell.x).toBeLessThanOrEqual(.75);expect(cell.y).toBeGreaterThanOrEqual(0);expect(cell.y).toBeLessThanOrEqual(.8);}
});
it('holds random expressions, blinks briefly and returns to the same expression',()=>{
 const rig=createFlurryFaceRig(seeded(1111)),seen=new Set<string>(),blinks=new Set<string>();let changes=0,previous='neutral';
 for(let i=0;i<90000;i++){const pose=rig.update(i*.01);seen.add(pose.face);if(pose.blink)blinks.add(pose.blink);if(pose.face!==previous){changes++;previous=pose.face;}}
 expect(seen.size).toBeGreaterThanOrEqual(16);expect(changes).toBeLessThan(500);expect(blinks).toEqual(new Set(['blink-half','blink-closed']));
 const predictable=createFlurryFaceRig(()=>.5);expect(predictable.update(0).blink).toBeNull();expect(predictable.update(3.31).blink).toBe('blink-half');expect(predictable.update(3.37).blink).toBe('blink-closed');expect(predictable.update(3.5).blink).toBeNull();
});
it('uses stable neutral reduced motion and safely restarts after a clock reset',()=>{
 const rig=createFlurryFaceRig(seeded(5));rig.update(0);rig.update(20);expect(rig.update(30,true)).toEqual({face:'neutral',blink:null});expect(rig.update(3)).toEqual({face:'neutral',blink:null});
});
