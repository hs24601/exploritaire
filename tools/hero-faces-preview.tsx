import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TableActorSprite } from '../src/proto/components/TableActorSprite';
import { claimActorExpression } from '../src/proto/actorExpression';
let release: (() => void) | undefined;
function Preview() {
  const [sad, setSad] = useState(false);
  const [pitch, setPitch] = useState(20);
  const [pose, setPose] = useState<'sitting' | 'standing' | 'walking'>('sitting');
  return <><button onClick={() => { release?.(); release = !sad ? claimActorExpression('hero', 'sad') : undefined; setSad(!sad); }}>{sad ? 'Neutral' : 'Sad'}</button>
    {[20,55,90].map(value => <button key={value} onClick={() => setPitch(value)}>{value}°</button>)}
    {(['sitting','standing','walking'] as const).map(value => <button key={value} onClick={() => setPose(value)}>{value}</button>)}
    <div key={pitch} style={{ display: 'flex', paddingTop:40, pointerEvents:'none' }}>{[0,45,90,135,180,225,270,315].map(yaw => <div key={yaw} style={{ width:160 }}>
      <div style={{ height:160 }}><TableActorSprite actorId="hero" position={{x:0,y:0}} heading={0} pose={pose} overhead={pitch === 90} fallback={null}
        getCamera={() => ({ x:0,y:0,scale:10,yaw })} getTilt={() => ({ angle:90-pitch, perspective:800 })} /></div><p>{pitch}° / {yaw}°</p>
    </div>)}</div></>;
}
document.body.style.cssText='background:#263b40;color:#eadcc0;font:16px sans-serif;margin:16px';
createRoot(document.getElementById('root')!).render(<Preview />);
