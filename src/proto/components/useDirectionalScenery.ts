import { useEffect, useRef, useState } from 'react';
import { directionalScenery, selectSceneryView } from '../directionalScenery';
import type { SpriteView } from '../directionalSprites';
import { prewarmSpriteBounds } from './spriteBounds';

type Camera={yaw?:number};
/** Update only when an authored view changes. Camera projection continues on
 * the existing live frame clock; all sources are warm before orbiting. */
export function useDirectionalScenery(src:string|undefined,active:boolean,getCamera:()=>Camera,onFrame:(draw:(camera:Camera)=>void)=>()=>void) {
  const [selected,setSelected]=useState<{src:string;flip:boolean;direction:number}|null>(null);
  const previous=useRef<SpriteView|undefined>(undefined);
  useEffect(()=>{
    const definition=directionalScenery(src);if(!active||!definition){setSelected(null);return;}
    let stopped=false,unsubscribe:undefined|(()=>void);previous.current=undefined;
    void Promise.all(definition.views.map(prewarmSpriteBounds)).then(()=>{
      if(stopped)return;
      const draw=(camera:Camera)=>{
        const next=selectSceneryView(definition,camera.yaw??0,previous.current);
        previous.current={direction:next.direction,elevation:'low',flip:next.flip?-1:1};
        setSelected(old=>old?.src===next.src&&old.flip===next.flip?old:{src:next.src,flip:next.flip,direction:next.direction});
      };
      draw(getCamera());unsubscribe=onFrame(draw);
    }).catch(()=>{ /* Keep the original painted cutout if a counterpart fails. */ });
    return()=>{stopped=true;unsubscribe?.();};
  },[src,active,getCamera,onFrame]);
  return active?selected:null;
}
