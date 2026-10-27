import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Callout } from '../src/proto/components/Callout';
import { CalloutEditingProvider } from '../src/proto/components/CalloutEditing';
const text = 'The days are getting darker.\n\nThe manaberries grow scarcer, and the nights feel colder.\n\nI should check the bush just outside my den.';
function Preview() {
  const [paused, setPaused] = useState(false), [editing, setEditing] = useState(false), [version, setVersion] = useState(0), [completed, setCompleted] = useState(0);
  return <CalloutEditingProvider enabled={editing}><main style={{font:'16px system-ui',background:'#17282b',color:'white',height:'100vh',margin:0}}>
    <button onClick={() => setPaused(p => !p)}>Pause</button><button onClick={() => setEditing(e => !e)}>Edit</button><button onClick={() => setVersion(v => v + 1)}>Restart</button><output>{completed}</output>
    <div className="proto-map"><div data-board-piece="actor" style={{position:'fixed',left:'45%',top:160,width:100,height:100,background:'#a78557'}}>Hero</div><div data-board-piece="actor" style={{position:'fixed',left:'70%',top:20,width:120,height:150,background:'#647c8e'}}>Banks</div></div>
    <Callout key={version} authoringId="sequence-test" speaker="Hero" text={text} marks={[{start:21,end:27,effect:'emphasis'}]} anchor={{x:innerWidth*.49,y:165}} emoji={{actor:'hero',emotion:'sad'}} durationMs={0} paused={paused} onComplete={() => setCompleted(c => c + 1)} />
  </main></CalloutEditingProvider>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
