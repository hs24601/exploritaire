import {it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {createWorldTreeScene,createTreeMovement,treeGround,treeWalkable} from './worldTreeScene';
import {WORLD_1111_LAYOUT} from './world1111Layout';
import {MeadowPortalEnd} from './castleMeadowPortal';
import {createWorldPortalGuard} from './worldPortalGuard';
import {CastleGroundsNavigation} from './castleGroundsNavigation';
import {CastlePlatformMotion} from './castlePlatformMotion';
// Only raster paint is mocked; retain the actual seeded solids and terrain.
vi.mock('./castleWatercolor',async()=>{const actual=await vi.importActual<typeof import('./castleWatercolor')>('./castleWatercolor');return {...actual,paintWcWood:()=>new THREE.Texture(),paintWcBank:()=>new THREE.Texture(),paintWcCliff:()=>new THREE.Texture()};});
vi.mock('./worldTreeGroundCover',()=>({createWorldTreeGroundCover:()=>({grassCards:0}),worldTreeSoilPaint:()=>new THREE.Texture()}));
vi.mock('./waterfallParticles',()=>({createWaterfallFlow:()=>({texture:new THREE.Texture(),update(){},dispose(){}})}));
it('physically reaches the new portal through the actual grove obstacles when clicked',()=>{
 const scene=new THREE.Scene(),art=[{aspect:992/1586,foot:.006},{aspect:1266/1242,foot:.035},{aspect:992/1586,foot:.006}].map(a=>({...a,texture:new THREE.Texture()}));
 const grove=createWorldTreeScene(scene,new THREE.MeshBasicMaterial(),m=>m,true,art),point=WORLD_1111_LAYOUT.woodsPortal;
 const door=new MeadowPortalEnd(scene,{...point,y:treeGround(point.x,point.z)},true,true),guard=createWorldPortalGuard();
 const clear=(x:number,z:number,r=.45,y=treeGround(x,z))=>treeWalkable(x,z,r)&&!guard.blocked([door],x,z,r,y)&&grove.movementClear(x,z,r,y);
 const surface=createTreeMovement(clear);
 const start=WORLD_1111_LAYOUT.hero,hero=new CastlePlatformMotion(start.x,start.z,Math.PI,surface),nav=new CastleGroundsNavigation(clear);
 guard.arm(door);expect(nav.setDestination(hero,door.point(.66))).toBe(true);let crossed=false;
 for(let i=0;i<2400;i++){const a=nav.steer(hero,1/120);hero.update(1/120,{x:a?.x??0,z:a?.z??0,run:!!a?.run,crouch:false,jumpPressed:!!a?.jump,jumpHeld:!!a,divePressed:false,sustainSprint:false});if(door.canCross(hero,guard.permits(door))){crossed=true;break;}}
 expect(crossed).toBe(true);expect(door.canCross(hero,false)).toBe(false);
});

it('walks through the former ivy bounding box while keeping actual wood and roots solid',()=>{
 const scene=new THREE.Scene(),art=[{aspect:.65,foot:0,texture:new THREE.Texture()}];
 const grove=createWorldTreeScene(scene,new THREE.MeshBasicMaterial(),m=>m,true,art);
 const clear=(x:number,z:number,r=.45,y=treeGround(x,z))=>treeWalkable(x,z,r)&&grove.movementClear(x,z,r,y);
 const oldBlocked=(x:number,z:number)=>grove.cameraObstacles.some(b=>x>b.min.x-.45&&x<b.max.x+.45&&z>b.min.z-.45&&z<b.max.z+.45&&treeGround(x,z)+1.2>b.min.y&&treeGround(x,z)<b.max.y);
 const opened:{x:number;z:number}[]=[];
 for(let z=30;z<=70;z+=2)for(let x=-40;x<=40;x+=2)if(clear(x,z)&&oldBlocked(x,z))opened.push({x,z});
 expect(opened.length).toBeGreaterThan(50);
 expect(clear(0,50)).toBe(true);
 const hero=new CastlePlatformMotion(0,70,Math.PI,createTreeMovement(clear)),navigation=new CastleGroundsNavigation(clear);
 expect(navigation.setDestination(hero,{x:0,z:50})).toBe(true);
 for(let i=0;i<1800&&navigation.destination;i++){
  const a=navigation.steer(hero,1/120);hero.update(1/120,{x:a?.x??0,z:a?.z??0,run:!!a?.run,crouch:false,jumpPressed:!!a?.jump,jumpHeld:!!a,divePressed:false,sustainSprint:false});
 }
 expect(hero.z).toBeCloseTo(50,0);expect(clear(0,-42)).toBe(false);
 let rootBlocked=0;
 for(let z=-10;z<=35;z+=2)for(let x=-55;x<=55;x+=2)if(treeWalkable(x,z)&&!grove.movementClear(x,z)&&grove.movementClear(x,z,.45,treeGround(x,z)+14))rootBlocked++;
 expect(rootBlocked).toBeGreaterThan(0);
});
