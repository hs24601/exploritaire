import {presentBookFrame} from './bootPresentation';
import {createBookLoading} from './bookLoading';
import './believeFilm.css';

/** Keep the supplied r180 film independent of the game's r170 renderer/editor. */
export function startBelieveFilm(canvas:HTMLCanvasElement){
 document.body.classList.add('believe-page');
 const loading=createBookLoading();loading.report(.08,'Preparing Believe');
 const frame=document.createElement('iframe');frame.id='believe-film';frame.title='Believe — a journey into a pop-up book';frame.allow='autoplay';
 const query=new URLSearchParams(location.search);query.delete('page');
 frame.src='/assets/runtime/book/believe/index.html'+(query.size?'?'+query:'');
 const error=document.getElementById('book-error')!;
 addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==location.origin)return;
  const data=event.data;if(data?.type==='believe:progress')loading.report(data.value,data.label);
  if(data?.type==='believe:error'){loading.fail();error.hidden=false;error.textContent='Believe could not open: '+data.message;console.error(data.message);}
  if(data?.type==='believe:state'){canvas.dataset.believePhase=data.phase;canvas.dataset.believeTime=String(data.time);}
  if(data?.type==='believe:ready'){
   canvas.dataset.believe='23';canvas.dataset.assetsReady='true';presentBookFrame(canvas);loading.finish();
   const send=(type:string,time?:number)=>frame.contentWindow?.postMessage({type,time},location.origin);
   dispatchEvent(new CustomEvent('book:believe-ready',{detail:{frame,duration:data.duration,seek:(time:number)=>send('believe:seek',time),play:()=>send('believe:play'),pause:()=>send('believe:pause')}}));
  }
 });
 document.body.append(frame);
}
