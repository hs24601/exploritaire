import {it,expect,vi} from 'vitest';
import {createWorldPropInteraction} from './worldPropInteraction';
import {CastleGroundsNavigation} from './castleGroundsNavigation';
import {CastlePlatformMotion} from './castlePlatformMotion';
import {treeSurface,treeWalkable} from './worldTreeScene';
import {WORLD_1111_LAYOUT,canCollectFlurry} from './world1111Layout';

it('walks Hero along the real grove surface and collects once in reach',()=>{
 const {hero:start,flurry}=WORLD_1111_LAYOUT,hero=new CastlePlatformMotion(start.x,start.z,0,treeSurface);
 const navigation=new CastleGroundsNavigation(treeWalkable),interaction=createWorldPropInteraction(navigation),collect=vi.fn(()=>true);
 expect(canCollectFlurry(hero,flurry)).toBe(false);
 expect(interaction.request(hero,{point:flurry,reach:6,interact:collect})).toBe('travelling');
 expect(collect).not.toHaveBeenCalled();expect(navigation.destination).toBeDefined();
 for(let i=0;i<1200&&interaction.pending;i++){
  const intent=navigation.steer(hero,1/60);hero.update(1/60,{x:intent?.x??0,z:intent?.z??0,run:!!intent?.run,crouch:false,jumpPressed:!!intent?.jump,jumpHeld:!!intent,divePressed:false,sustainSprint:false});interaction.update(hero);
  expect(treeWalkable(hero.x,hero.z)).toBe(true);
 }
 expect(collect).toHaveBeenCalledOnce();expect(canCollectFlurry(hero,flurry)).toBe(true);expect(navigation.destination).toBeUndefined();
 interaction.update(hero);expect(collect).toHaveBeenCalledOnce();
});
it('interacts immediately nearby and does not keep a cancelled or superseded pickup',()=>{
 const navigation=new CastleGroundsNavigation(()=>true),interaction=createWorldPropInteraction(navigation),collect=vi.fn(()=>true),hero={x:0,y:0,z:0};
 const target={point:{x:20,z:0},reach:6,interact:collect};
 expect(interaction.request(hero,target)).toBe('travelling');navigation.clear();interaction.update({x:20,y:0,z:0});expect(collect).not.toHaveBeenCalled();
 expect(interaction.request(hero,target)).toBe('travelling');navigation.setDestination(hero,{x:20,z:2});interaction.update({x:20,y:0,z:0});expect(collect).not.toHaveBeenCalled();
 expect(interaction.request({x:20,y:0,z:0},target)).toBe('interacted');expect(collect).toHaveBeenCalledOnce();
});
it('rejects unreachable props and waits for grounded arrival',()=>{
 const navigation=new CastleGroundsNavigation(()=>false),interaction=createWorldPropInteraction(navigation),collect=vi.fn(()=>true);
 expect(interaction.request({x:0,y:0,z:0},{point:{x:20,z:0},reach:6,interact:collect})).toBe('blocked');expect(collect).not.toHaveBeenCalled();
 const airborneNav=new CastleGroundsNavigation(()=>true),airborne=createWorldPropInteraction(airborneNav),target={point:{x:0,z:0},reach:6,interact:collect};
 expect(airborne.request({x:1,y:2,z:0,grounded:false},target)).toBe('travelling');airborne.update({x:1,y:2,z:0,grounded:false});expect(collect).not.toHaveBeenCalled();airborne.update({x:1,y:0,z:0,grounded:true});expect(collect).toHaveBeenCalledOnce();
});
