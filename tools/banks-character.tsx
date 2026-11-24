// Art review fixture using production cards and the shared travel/combat rig.
import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as THREE from 'three';
import {BANKS_CHARACTER,BANKS_DIRECTIONAL_SPRITE,BANKS_POSES,BANKS_SPRITE_ASSETS} from '../src/proto/banksSprite';
import {createDirectionalSpriteLibrary} from '../src/proto/directionalSpriteRig';
import {CardJumboProvider,useCardJumbo} from '../src/proto/components/CardJumbo';
import {TradingCard} from '../src/proto/components/TradingCard';
import {ActorCardArt} from '../src/proto/components/DetailsCardViewer';
import {ACTOR_HOLO_ART} from '../src/proto/art/actorCardArt';
import '../src/index.css';
import './banks-character.css';
function Rig({pose,elevation,heading}:{pose:string;elevation:number;heading:number}){
 const host=useRef<HTMLDivElement>(null),live=useRef({pose,elevation,heading});live.current={pose,elevation,heading};
 useEffect(()=>{let stopped=false,raf=0;const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(440,440);renderer.setPixelRatio(1);host.current!.append(renderer.domElement);
 const scene=new THREE.Scene(),display=new THREE.OrthographicCamera(-.8,.8,1.35,-.25,.1,100);display.position.z=10;const eye=new THREE.PerspectiveCamera();
 let library:ReturnType<typeof createDirectionalSpriteLibrary>|undefined,actor:ReturnType<ReturnType<typeof createDirectionalSpriteLibrary>['create']>|undefined;
 const textures:THREE.Texture[]=[];
 const load=async()=>{const entries=await Promise.all(Object.entries(BANKS_SPRITE_ASSETS).map(async([key,path])=>{const texture=await new THREE.TextureLoader().loadAsync(`/assets/${path}`);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.userData.watercolor=true;textures.push(texture);return [key,texture] as const;}));if(stopped){textures.forEach(t=>t.dispose());return;}
 library=createDirectionalSpriteLibrary(Object.fromEntries(entries),BANKS_DIRECTIONAL_SPRITE,BANKS_POSES);actor=library.create(1);scene.add(actor.root);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');const paint=(now:number)=>{if(stopped||!actor)return;const {pose,elevation,heading}=live.current,angle=elevation*Math.PI/180;eye.position.set(0,10*Math.sin(angle),10*Math.cos(angle));actor.setPose(pose);actor.update(eye,heading*Math.PI/180,now/1000,reduced.matches,0,pose==='walking'?1:0);actor.billboard.rotation.set(0,0,actor.view?.elevation==='top'?heading*Math.PI/180:0);display.top=actor.view?.elevation==='top'?.8:1.35;display.bottom=actor.view?.elevation==='top'?-.8:-.25;display.updateProjectionMatrix();renderer.domElement.dataset.pose=actor.pose;renderer.domElement.dataset.frame=actor.frame;renderer.domElement.dataset.phase=String(actor.animationFrame);renderer.render(scene,display);raf=requestAnimationFrame(paint);};paint(0);};void load().catch(error=>{if(host.current)host.current.dataset.error=String(error);});
 return()=>{stopped=true;cancelAnimationFrame(raf);actor?.dispose();library?.dispose();textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();};},[]);
 return <div className="banks-rig" ref={host} aria-label={`Banks ${pose} at ${elevation} degrees`}/>;
}
function BanksCard(){const viewer=useCardJumbo();const art=<ActorCardArt sprite={ACTOR_HOLO_ART.banks} label="Banks"/>;const open=()=>viewer?.open({title:'Banks',content:<TradingCard id="banks" title="Banks" state="jumbo" badge="✦" badgeLabel="Gray tabby cat" description={`${BANKS_CHARACTER.description} Baseline abilities: Bite, Scratch, Hunt, Stealth.`} art={art}/>});return <div className="banks-review__card" role="button" tabIndex={0} aria-label="Inspect Banks holocard" onClick={open} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}}}><TradingCard id="banks" title="Banks" state="compact" badge="✦" badgeLabel="Gray tabby cat" description={BANKS_CHARACTER.description} descriptionPreview="Bite · Scratch · Hunt · Stealth" art={art}/></div>;}
function App(){const [pose,setPose]=useState('sitting'),[elevation,setElevation]=useState(20),[heading,setHeading]=useState(0);
 return <CardJumboProvider><main className="banks-review"><header><span>EXPLORITAIRE · CHARACTER ART</span><h1>Banks</h1><p>Gray tabby · Bite · Scratch · Hunt · Stealth</p></header><section className="banks-review__body"><BanksCard/><div className="banks-review__poses"><Rig {...{pose,elevation,heading}}/><div className="banks-controls"><div>{['sitting','standing','walking','flinch','down'].map(value=><button key={value} aria-pressed={value===pose} onClick={()=>setPose(value)}>{value}</button>)}</div><div>{[[20,'Low'],[55,'Elevated'],[90,'Overhead']].map(([angle,label])=><button key={label} aria-pressed={angle===elevation} onClick={()=>setElevation(Number(angle))}>{label}</button>)}</div><label>Facing <input aria-label="Facing" type="range" min="0" max="315" step="45" value={heading} onChange={event=>setHeading(Number(event.target.value))}/>{heading}°</label></div></div></section></main></CardJumboProvider>;
}
createRoot(document.getElementById('root')!).render(<App/>);
