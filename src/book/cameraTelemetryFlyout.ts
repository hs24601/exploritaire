import './cameraTelemetryFlyout.css';

/** Always expose the snapshot first: clipboard permissions are optional. */
export function createCameraTelemetryFlyout(snapshot:()=>unknown){
 const flyout=document.createElement('aside');flyout.className='camera-telemetry-flyout';flyout.hidden=true;flyout.setAttribute('role','dialog');flyout.setAttribute('aria-label','Camera telemetry');
 flyout.innerHTML='<header><h2>Camera telemetry</h2><button type="button" data-action="close" aria-label="Close camera telemetry">Close</button></header><p>Select the text and press Ctrl+C, or use Copy text.</p><textarea readonly aria-label="Camera telemetry JSON" spellcheck="false"></textarea><div class="camera-telemetry-actions"><button type="button" data-action="copy">Copy text</button><button type="button" data-action="refresh">Refresh snapshot</button></div><p role="status"></p>';
 document.body.append(flyout);const text=flyout.querySelector('textarea')!,status=flyout.querySelector<HTMLElement>('[role="status"]')!;let trigger:HTMLElement|undefined;
 function select(){text.focus();text.select();text.setSelectionRange(0,text.value.length);}
 function refresh(){text.value=JSON.stringify(snapshot(),null,2);status.textContent='Snapshot ready to select and copy.';}
 function close(){flyout.hidden=true;trigger?.setAttribute('aria-expanded','false');trigger?.focus();}
 flyout.querySelector<HTMLButtonElement>('[data-action="close"]')!.onclick=close;
 flyout.querySelector<HTMLButtonElement>('[data-action="refresh"]')!.onclick=()=>{refresh();select();};
 flyout.querySelector<HTMLButtonElement>('[data-action="copy"]')!.onclick=async()=>{
  select();try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(text.value);status.textContent='Camera telemetry copied.';}
  catch{select();status.textContent='Clipboard access is unavailable. Text is selected; press Ctrl+C to copy.';}
 };
 flyout.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}});
 return {open(button:HTMLElement){trigger=button;refresh();flyout.hidden=false;button.setAttribute('aria-expanded','true');select();},close};
}
