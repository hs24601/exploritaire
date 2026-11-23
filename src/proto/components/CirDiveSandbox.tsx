import { useEffect, useRef, useState } from 'react';
import { CIR_DIVE_ATLAS, CIR_DIVE_DURATION, CIR_DIVE_POSES, cirDiveSample } from '../cirDive';
import './CirDiveSandbox.css';

const sky = `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`;

/** Art review only: no cast timing, damage, or card-input changes. */
export function CirDiveSandbox() {
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [playing,setPlaying]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [time,setTime]=useState(()=>reduced?CIR_DIVE_DURATION*4.5/8:0),[speed,setSpeed]=useState(1),[travel,setTravel]=useState(true),[background,setBackground]=useState(true);
  const clock=useRef(time);
  useEffect(()=>{
    const query=matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>{setReduced(query.matches);if(query.matches)setPlaying(false);};
    query.addEventListener('change',change);return()=>query.removeEventListener('change',change);
  },[]);
  useEffect(()=>{
    if(!playing||reduced)return;
    let request=0,last=0;
    const tick=(now:number)=>{
      if(document.hidden){last=0;request=requestAnimationFrame(tick);return;}
      if(last){clock.current=(clock.current+Math.min(64,now-last)*speed)%CIR_DIVE_DURATION;setTime(clock.current);}
      last=now;request=requestAnimationFrame(tick);
    };
    request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request);
  },[playing,reduced,speed]);
  const seek=(value:number)=>{setPlaying(false);clock.current=value;setTime(value);};
  const sample=cirDiveSample(time,travel&&!reduced);
  const frame=sample.frame;
  return <main className="cir-dive-lab">
    <header><p className="cir-dive-lab__eyebrow">Cir · animation study</p><h1>Meteor dive</h1><p>Gather. Fold. Become a shooting star.</p></header>
    <div className="cir-dive-lab__stage" data-background={background} data-frame={frame} data-playing={playing&&!reduced}>
      {background&&<img className="cir-dive-lab__sky" src={sky} alt="" />}
      <div className="cir-dive-lab__flight" style={{transform:`translate(${sample.x}%,${sample.y}%) rotate(${sample.rotation}deg)`,opacity:reduced?1:sample.opacity}}>
        <div className="cir-dive-lab__sprite" role="img" aria-label="Cir folding her wings into a gold-orange meteor dive" style={{backgroundImage:`url("${CIR_DIVE_ATLAS}")`,backgroundPosition:`${(frame%4)*100/3}% ${Math.floor(frame/4)*100}%`}} />
      </div>
    </div>
    <section className="cir-dive-lab__controls" aria-label="Animation controls">
      <div className="cir-dive-lab__buttons"><button type="button" disabled={reduced} onClick={()=>setPlaying(!playing)}>{playing&&!reduced?'Pause':'Play'}</button><button type="button" onClick={()=>{clock.current=0;setTime(0);setPlaying(!reduced);}}>Replay dive</button>
      <label>Speed <select aria-label="Animation speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>½×</option><option value={1}>1×</option><option value={1.5}>1½×</option></select></label></div>
      <label className="cir-dive-lab__scrubber">Dive progress<input aria-label="Dive progress" type="range" min="0" max={CIR_DIVE_DURATION-1} value={Math.round(time)} onChange={e=>seek(Number(e.target.value))}/></label>
      <div className="cir-dive-lab__buttons"><label><input type="checkbox" checked={travel} onChange={e=>setTravel(e.target.checked)}/>Diving path</label><label><input type="checkbox" checked={background} onChange={e=>setBackground(e.target.checked)}/>Night forest</label><output>{CIR_DIVE_POSES[frame]}</output></div>
      {reduced&&<p>Reduced motion: a still meteor pose. The pose strip below shows all eight paintings.</p>}
    </section>
    <section className="cir-dive-lab__poses" aria-label="Dive poses">{CIR_DIVE_POSES.map((name,i)=><button type="button" key={name} aria-label={`Pose ${i+1}: ${name}`} aria-pressed={frame===i} onClick={()=>seek((i+.5)*CIR_DIVE_DURATION/8)}><span style={{backgroundImage:`url("${CIR_DIVE_ATLAS}")`,backgroundPosition:`${(i%4)*100/3}% ${Math.floor(i/4)*100}%`}}/><b>{name}</b></button>)}</section>
    <a href={`${import.meta.env.BASE_URL}proto.html?kerusbx&element=fire`}>Cir’s holocards</a>
  </main>;
}
