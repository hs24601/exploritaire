import {it,expect} from 'vitest';
import {HeroWorldDirector} from './heroWorldDirector';
import {CastleHeroIdle} from './castleHeroIdle';
const standing={grounded:true,speed:0,grade:0,crouching:false,airTime:0,flightTime:1,jumpNumber:0,airMove:'jump'};
it('keeps a nearby enemy focused and standing, with pre-lunge bows instead of relaxed idles',()=>{
 const d=new HeroWorldDirector(()=>0),old=new CastleHeroIdle(()=>0),seen=new Set<string>();
 for(let i=0;i<900;i++){const p=d.update(.1,standing,true,false,true);seen.add(p!.action);expect(old.update(.1,false,false).action).toBe('stand');}
 expect([...seen].sort()).toEqual(['combatBow','combatReady']);
 expect(d.update(.1,{...standing,speed:2},false,false,true)?.action).toBe('combatStalk');
 expect(d.update(.1,{...standing,grounded:false,airTime:.4},false,false,true)?.action).toBe('combatLeap');
 expect(d.update(.1,standing,true,true,true)).toEqual({action:'combatReady',seconds:0});
 expect(d.update(.1,standing,true,false,false)?.action).toBeUndefined();
});
