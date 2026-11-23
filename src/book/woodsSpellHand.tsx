import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {currentFxQuality} from '../proto/fxQuality';
import {LayeredCardArt} from '../proto/components/LayeredCardArt';
import {TradingCard} from '../proto/components/TradingCard';
import {BiteLenticularArt} from '../proto/components/BiteLenticularArt';
import {useHoloOpticsSettings} from '../proto/holoOpticsSettings';
import {FLURRY_FACE_ATLAS,flurryFaceCell} from '../sticker/flurryExpressions';
import {LUSTRO_ART,lustroFacePosition,lustroLenticularFace,type LustroFaceId} from '../sticker/lustroExpressions';
import {spellDefinition,entityDefinition,entityForSpell,type WoodsEntity,type WoodsSpell} from './woodsSpellRules';
import '../proto/components/LayeredCardArt.css';
const background=`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`;
function LenticularFace({flurry=false}:{flurry?:boolean}){
 const ref=useRef<HTMLSpanElement>(null),settings=useHoloOpticsSettings(),[face,setFace]=useState<LustroFaceId>('confident');
 useEffect(()=>{
  const card=ref.current?.closest<HTMLElement>('.trading-card');if(!card)return;
  const media=matchMedia('(prefers-reduced-motion:reduce)');let hovered=card.matches(':hover'),timer:ReturnType<typeof setTimeout>|undefined;
  const enabled=()=>settings.enabled&&!media.matches&&!card.closest('[data-fx="low"],[data-fx="off"],.trading-card--frozen');
  const stop=()=>{if(timer!==undefined)clearTimeout(timer);timer=undefined;};
  const cycle=()=>{timer=undefined;if(!hovered||!enabled())return;const faces:LustroFaceId[]=['confident','happy','determined','surprised','wink'];setFace(previous=>{const choices=faces.filter(face=>face!==previous);return choices[Math.floor(Math.random()*choices.length)];});timer=setTimeout(cycle,1800+Math.random()*2200);};
  const update=()=>{if(hovered&&enabled()){if(timer===undefined)timer=setTimeout(cycle,900);return;}stop();const x=Number(getComputedStyle(card).getPropertyValue('--art-shift-x'))||0;setFace(lustroLenticularFace(x,enabled()));};
  const enter=()=>{hovered=true;update();},leave=()=>{hovered=false;update();};
  const motion=new MutationObserver(update);motion.observe(card,{attributes:true,attributeFilter:['style','class']});
  card.addEventListener('mouseenter',enter);card.addEventListener('mouseleave',leave);media.addEventListener('change',update);update();
  return()=>{stop();motion.disconnect();card.removeEventListener('mouseenter',enter);card.removeEventListener('mouseleave',leave);media.removeEventListener('change',update);};
 },[settings.enabled]);
 const flurryFace=face==='determined'?'determined':face==='wink'?'wink-left':face==='surprised'?'surprised':face==='happy'?'happy':'content',cell=flurryFaceCell(flurryFace);
 return <span ref={ref} className="woods-holo-face" data-lustro-expression={flurry?undefined:face} data-flurry-expression={flurry?flurryFace:undefined} style={{backgroundImage:`url("${flurry?FLURRY_FACE_ATLAS.url:LUSTRO_ART+'faces.png'}")`,backgroundSize:flurry?'400% 500%':'300% 300%',backgroundPosition:flurry?`${cell.column/3*100}% ${cell.row/4*100}%`:lustroFacePosition(face)}}/>;
}
function EntityArt({entity}:{entity:WoodsEntity}){
 if(entity==='hero')return <LayeredCardArt background={background} subject={`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-watercolor-v6-organic-bobtail.png`} label="Hero"/>;

 return <div className="layered-card-art woods-holo-art" role="img" aria-label={`${entityDefinition(entity).name} layered portrait`}>
  <img className="layered-card-art__background" src={background} alt="" draggable={false}/>
  <span className="woods-holo-subject"><img src={entity==='lustro'?LUSTRO_ART+'body.png':`${import.meta.env.BASE_URL}assets/runtime/ui/stickers/snowflake-v1/ice.png`} alt="" draggable={false}/>
   <LenticularFace flurry={entity==='flurry'}/>
  </span>
 </div>;
}
function SpellArt({spell}:{spell:WoodsSpell}){
 if(spell==='bite')return <BiteLenticularArt/>;
 if(spell==='meteo')return <div className="layered-card-art woods-holo-art" role="img" aria-label="Meteo fireball artwork"><img className="layered-card-art__background" src={background} alt="" draggable={false}/><span className="woods-holo-subject"><img src={import.meta.env.BASE_URL+'assets/runtime/spells/fireball/v1/fireball.png'} alt="" draggable={false}/></span></div>;
 return <><EntityArt entity={entityForSpell(spell)}/>{entityForSpell(spell)==='flurry'&&<span className="woods-ice-ability-mark" aria-hidden="true">{spellDefinition(spell).symbol}</span>}</>;
}
/** Native host buttons own all selection and drag capture. */
function mountFace(host:HTMLButtonElement,id:string,title:string,art:ReactNode,description:string,footer:string){
 const root=createRoot(host);host.dataset.holoHost='true';let frozen:boolean|undefined;
 const render=(paused:boolean)=>{const next=paused||currentFxQuality()==='low'||!!host.closest('[data-fx="low"],[data-fx="off"]');if(frozen===next)return;frozen=next;flushSync(()=>root.render(<TradingCard id={id} title={title} art={art} description={description} footer={footer} interactive={false} motionFromParent paused={next} finish="diagonal-holo" state="compact" className="woods-holo-card"/>));};render(false);
 return {setPaused:render,dispose(){root.unmount();delete host.dataset.holoHost;}};
}
export function mountWoodsSpellHandCard(host:HTMLButtonElement,spell:WoodsSpell){const def=spellDefinition(spell);return mountFace(host,spell==='bite'?'hero-bite':`woods-${spell}`,def.name,<SpellArt spell={spell}/>,def.effect,'Four cornerstones to cast');}
export function mountWoodsEntityCard(host:HTMLButtonElement,entity:WoodsEntity,pinned=false){const def=entityDefinition(entity);return mountFace(host,`woods-entity-${entity}`,def.name,<EntityArt entity={entity}/>,def.description,pinned?'Fold abilities':'Choose an ability');}
