import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TableActorSprite } from '../src/proto/components/TableActorSprite';
import { claimActorExpression } from '../src/proto/actorExpression';
let release: (() => void) | undefined;
function Preview() {
  const [pitch, setPitch] = useState(20);
  const [pose, setPose] = useState<'sitting' | 'standing' | 'walking'>('sitting');
  const [emotion,setEmotion]=useState<'sad'|'neutral'|'curious'|'happy'|'joyful'>('curious');
  useLayoutEffect(() => { release = claimActorExpression('hero', 'curious'); return () => release?.(); }, []);
  return <><button onClick={() => { release?.(); release = claimActorExpression('hero', 'sad'); setEmotion('sad'); }}>Sad</button>
    <button onClick={()=>{release?.(); release=claimActorExpression('hero','neutral');setEmotion('neutral');}}>Neutral expression</button><span>{emotion}</span>
    <button onClick={()=>{release?.(); release=claimActorExpression('hero','curious');setEmotion('curious');}}>Curious expression</button>
    <button onClick={()=>{release?.(); release=claimActorExpression('hero','happy');setEmotion('happy');}}>Happy expression</button>
    <button onClick={()=>{release?.(); release=claimActorExpression('hero','joyful');setEmotion('joyful');}}>Joyful expression</button>
    {[20,55,90].map(value => <button key={value} onClick={() => setPitch(value)}>{value}°</button>)}
    {(['sitting','standing','walking'] as const).map(value => <button key={value} onClick={() => setPose(value)}>{value}</button>)}
    <div key={pitch} style={{ display: 'flex', paddingTop:40, pointerEvents:'none' }}>{[0,45,90,135,180,225,270,315].map(yaw => <div key={yaw} style={{ width:208 }}>
      <div style={{ height:160, width:160, margin:24 }}><TableActorSprite actorId="hero" position={{x:0,y:0}} heading={0} pose={pose} overhead={pitch === 90} fallback={null}
        getCamera={() => ({ x:0,y:0,scale:10,yaw })} getTilt={() => ({ angle:90-pitch, perspective:800 })} /></div><p>{pitch}° / {yaw}°</p>
    </div>)}</div></>;
}
document.body.style.cssText='background:#263b40;color:#eadcc0;font:16px sans-serif;margin:16px';
const previewStyle = document.createElement('style');
previewStyle.textContent = 'button { font: inherit; }'; document.head.append(previewStyle);
createRoot(document.getElementById('root')!).render(<Preview />);
