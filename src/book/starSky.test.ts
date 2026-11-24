import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createStarSky} from './starSky';
it('distributes a single static star buffer over the sky without overlapping bands',()=>{
 const sky=createStarSky(new THREE.Scene()),p=sky.root.geometry.getAttribute('position'),a=new THREE.Vector3(),b=new THREE.Vector3();let nearest=Infinity;
 for(let i=0;i<p.count;i++)for(let j=i+1;j<p.count;j++){a.fromBufferAttribute(p,i).normalize();b.fromBufferAttribute(p,j).normalize();nearest=Math.min(nearest,a.distanceTo(b));}
 expect(p.count).toBeLessThanOrEqual(640);expect(nearest).toBeGreaterThan(.05);sky.dispose();
});
