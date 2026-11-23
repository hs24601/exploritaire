import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createFlurryFaceRig,FLURRY_FACE_ATLAS,flurryFaceCell,type FlurryFaceId,type FlurryFacePose} from './flurryExpressions';
import './flurryFace.css';
export function flurryFaceStyle(id:FlurryFaceId):CSSProperties{const {column,row}=flurryFaceCell(id);return {backgroundImage:`url("${FLURRY_FACE_ATLAS.url}")`,backgroundSize:'400% 500%',backgroundPosition:`${column/3*100}% ${row/4*100}%`};}
export function FlurryFace({animated=true,className=''}:{animated?:boolean;className?:string}){
 const rig=useRef<ReturnType<typeof createFlurryFaceRig>|null>(null);if(!rig.current)rig.current=createFlurryFaceRig();
 const [pose,setPose]=useState<FlurryFacePose>({face:'neutral',blink:null});
 useEffect(()=>{if(!animated)return;const media=matchMedia('(prefers-reduced-motion: reduce)');let frame=0;
  const tick=(now:number)=>{const next=rig.current!.update(now/1000,media.matches);setPose(previous=>previous.face===next.face&&previous.blink===next.blink?previous:next);if(!media.matches)frame=requestAnimationFrame(tick);};
  const restart=()=>{cancelAnimationFrame(frame);tick(performance.now());};restart();media.addEventListener('change',restart);return()=>{cancelAnimationFrame(frame);media.removeEventListener('change',restart);};
 },[animated]);
 const face=animated?pose.face:'neutral',blink=animated?pose.blink:null;
 return <span className={`flurry-face ${className}`} data-expression={face} data-blink={blink??undefined} aria-hidden="true">
  <span className="flurry-face__layer" style={{...flurryFaceStyle(face),clipPath:blink?'inset(50% 0 0)':'none'}}/>
  {blink&&<span className="flurry-face__layer" style={{...flurryFaceStyle(blink),clipPath:'inset(0 0 50%)'}}/>}
 </span>;
}
