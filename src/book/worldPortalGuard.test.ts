import {it,expect} from 'vitest';
import * as THREE from 'three';
import {MeadowPortalEnd} from './castleMeadowPortal';
import {createWorldPortalGuard} from './worldPortalGuard';
import {planGroundsRoute,groundsSegmentClear} from './castleGroundsNavigation';
import {createMeadowTerrain,createMeadowNavigation} from './castleMeadowNavigation';
const door=()=>new MeadowPortalEnd(new THREE.Scene(),{x:0,y:0,z:0,yaw:0},true,true);
it('routes around unselected portals and only arms the exact clicked doorway',()=>{
 const a=door(),b=door();b.group.position.x=20;const guard=createWorldPortalGuard();
 const clear=(x:number,z:number,r=.45)=>Math.abs(x)<15&&Math.abs(z)<15&&!guard.blocked([a],x,z,r,0);
 const start={x:0,z:5},goal={x:0,z:-5},route=planGroundsRoute(start,goal,clear)!;expect(route.length).toBeGreaterThan(1);
 let anchor=start;for(const next of route){expect(groundsSegmentClear(anchor,next,.45,clear)).toBe(true);anchor=next;}
 expect(a.canCross({x:0,z:.5,y:0,vx:0,vz:-1},false)).toBe(false);
 guard.arm(a);expect(guard.permits(a)).toBe(true);expect(guard.permits(b)).toBe(false);
 expect(planGroundsRoute(start,{x:0,z:.66},clear)).toEqual([{x:0,z:.66}]);
 guard.arm(undefined,{x:0,z:.5});expect(guard.permits(a)).toBe(false);expect(guard.blocked([a],0,.5)).toBe(false);
 guard.arm();expect(guard.blocked([a],0,.5)).toBe(true);
});
it('invalidates foreign-world cached routes after clearing portal intent',()=>{
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(24,24).rotateX(-Math.PI/2));mesh.updateMatrixWorld();
 const terrain=createMeadowTerrain([mesh],{minX:-12,maxX:12,minZ:-12,maxZ:12,minY:-.1}),nav=createMeadowNavigation(terrain),a=door(),guard=createWorldPortalGuard();terrain.setRouteObstacle((x,z,r,y)=>guard.blocked([a],x,z,r,y));
 guard.arm(a);expect(nav.setDestination({x:0,y:0,z:5},{x:0,y:0,z:.66})).toBe(true);
 guard.arm();nav.clear();nav.invalidate();expect(nav.setDestination({x:0,y:0,z:5},{x:0,y:0,z:-5})).toBe(true);
 expect(nav.cameraRoute.some(p=>Math.abs(p.x)>2.9)).toBe(true);
});
