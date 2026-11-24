// Production cinema in an isolated art fixture; does not change authored days.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BanksRescueCinema} from '../src/proto/components/BanksRescueCinema';
import {CardJumboProvider} from '../src/proto/components/CardJumbo';
import '../src/index.css';
function Preview(){const [run,setRun]=useState(0),[done,setDone]=useState(false);return <CardJumboProvider>{done?<button onClick={()=>{setDone(false);setRun(value=>value+1);}}>Replay Banks rescue</button>:<BanksRescueCinema key={run} onComplete={()=>setDone(true)} onExit={()=>setRun(value=>value+1)}/>}</CardJumboProvider>;}
createRoot(document.getElementById('root')!).render(<Preview/>);
