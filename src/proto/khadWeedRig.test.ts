import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createKhadWeed, sampleThornWhip } from './khadWeedRig';
it('reaches the target at the shared .24 second impact and retracts by the end',()=>{
  expect(sampleThornWhip(-1).active).toBe(false);
  expect(sampleThornWhip(.09).windup).toBeGreaterThan(.9);
  expect(sampleThornWhip(.24).reach).toBe(1);
  expect(sampleThornWhip(.62)).toEqual({active:false,windup:0,reach:0});
});
it('keeps every joint finite, holds the same pose at a frozen clock, and resets a defeat',()=>{
  const rig=createKhadWeed();rig.attack(1,new Vector3(-6,1,0));rig.update(1.24,false);
  const positions=()=>{const values:number[]=[];rig.root.traverse(o=>values.push(...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()));return values;};
  const pose=positions();expect(pose.every(Number.isFinite)).toBe(true);rig.update(1.24,false);expect(positions()).toEqual(pose);
  rig.defeat(2);rig.update(3.2,false);expect(rig.root.children[0].scale.y).toBeLessThan(.1);
  rig.reset();rig.update(4,true);expect(rig.root.children[0].scale.y).toBe(1);expect(positions().every(Number.isFinite)).toBe(true);
  rig.dispose();
});
