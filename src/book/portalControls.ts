export type PortalPad = {active:boolean;x:number;y:number;zoom:number;lookX:number;lookY:number;sprint:boolean;jump:boolean;jumpHeld:boolean;attack:boolean;crouch:boolean;center:boolean;interact:boolean};
export const emptyPortalPad=():PortalPad=>({active:false,x:0,y:0,zoom:0,lookX:0,lookY:0,sprint:false,jump:false,jumpHeld:false,attack:false,crouch:false,center:false,interact:false});
/** Standard Gamepad API layout. Read edges even while paused so held buttons
 * cannot leak a jump or confirmation into the next screen. */
export function createPortalControls(canvas:HTMLCanvasElement,display:HTMLElement,clear:()=>void){
 const overlay=document.createElement('div');overlay.className='portals-pause';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Paused');
 overlay.innerHTML='<div class="portals-menu"><h1>Paused</h1><div data-pause-home><button data-resume>Resume</button><button data-settings>Settings</button></div><div data-settings-page hidden><nav role="tablist" aria-label="Settings tabs"></nav><div class="portals-settings-content"></div><button data-back>Back</button></div><p class="portals-pad-help">A select · B back · ↑ ↓ navigate · ← → adjust · LB / RB tabs · Start resume</p></div>';
 document.body.append(overlay);
 const connection=document.createElement('p');connection.className='portals-pad-help';connection.setAttribute('role','status');
 if(!isSecureContext||!navigator.getGamepads)connection.textContent='Controller access requires HTTPS or localhost. Mouse and keyboard are available.';
 overlay.querySelector('.portals-menu')!.append(connection);
 function gamepads(){try{return navigator.getGamepads?.()??[];}catch{connection.textContent='This browser has blocked controller access. Use HTTPS or localhost and allow gamepads.';return [];}}

 const home=overlay.querySelector<HTMLElement>('[data-pause-home]')!,settings=overlay.querySelector<HTMLElement>('[data-settings-page]')!,nav=overlay.querySelector<HTMLElement>('nav')!,content=overlay.querySelector<HTMLElement>('.portals-settings-content')!;
 const tabs:{button:HTMLButtonElement;pane:HTMLElement;available:()=>boolean;select:()=>void}[]=[];
 let previous:boolean[]=[],lastDirection='',repeatAt=0,tabIndex=0,editingText=false,caret=0;
 const visible=(e:HTMLElement)=>!e.closest('[hidden]')&&e.getClientRects().length>0;
 const items=()=>Array.from(overlay.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')).filter(e=>visible(e)&&!(e as HTMLInputElement).disabled&&e.getAttribute('role')!=='tab');
 function focusFirst(){items()[0]?.focus();}
 function selectTab(index:number){const next=(index+tabs.length)%tabs.length;if(!tabs[next].available())return;tabIndex=next;for(const [i,tab]of tabs.entries()){tab.pane.hidden=i!==tabIndex;tab.button.setAttribute('aria-selected',String(i===tabIndex));tab.button.tabIndex=i===tabIndex?0:-1;}tabs[tabIndex].pane.hidden=false;tabs[tabIndex].pane.setAttribute('aria-labelledby',tabs[tabIndex].button.id);tabs[tabIndex].select();editingText=false;focusFirst();}
 function addTab(name:string,pane:HTMLElement,available=()=>true,select=()=>{}){const b=document.createElement('button');b.textContent=name;b.type='button';b.setAttribute('role','tab');b.id=`portals-tab-${tabs.length}`;pane.id ||= `portals-pane-${tabs.length}`;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',b.id);b.setAttribute('aria-controls',pane.id);b.onclick=()=>selectTab(tabs.findIndex(t=>t.button===b));nav.append(b);content.append(pane);tabs.push({button:b,pane,available,select});selectTab(0);}
 display.hidden=false;addTab('Display',display);
 const guide=document.createElement('section');guide.innerHTML='<h2>Controller</h2><p>Mario 64 style controls with a standard controller.</p><dl><dt>Left stick</dt><dd>Walk / run (analog)</dd><dt>Hold LB + left stick up / down</dt><dd>Slow zoom in / out</dd><dt>A (hold while moving)</dt><dd>Sprint</dd><dt>B</dt><dd>Jump / swim jump</dd><dt>X</dt><dd>Dive in the air (no ground attack yet)</dd><dt>LT / ZL</dt><dd>Z: crouch, ground pound; hold on the ground to crouch</dd><dt>Right stick / D-pad</dt><dd>C-buttons: rotate camera</dd><dt>RB / R</dt><dd>Center camera behind Hero</dd><dt>Y</dt><dd>Interact with nearby sticker or portal</dd><dt>Start / Menu</dt><dd>Pause / resume</dd></dl><p>Settings: LB / RB changes tabs, up / down selects controls, left / right changes values, A activates, B goes back. Names: A edits, left / right moves the caret, up / down changes its character, A finishes. Mouse and keyboard remain available.</p>';
 addTab('Controller',guide);
 function setPaused(value:boolean){overlay.hidden=!value;clear();editingText=false;canvas.dataset.portalsPaused=String(value);if(value){home.hidden=false;settings.hidden=true;focusFirst();}else canvas.focus();}
 function back(){if(editingText){editingText=false;return;}if(!settings.hidden){settings.hidden=true;home.hidden=false;focusFirst();}else setPaused(false);}
 overlay.querySelector<HTMLButtonElement>('[data-resume]')!.onclick=()=>setPaused(false);
 overlay.querySelector<HTMLButtonElement>('[data-settings]')!.onclick=()=>{home.hidden=true;settings.hidden=false;selectTab(tabIndex);};
 overlay.querySelector<HTMLButtonElement>('[data-back]')!.onclick=back;
 const pauseButton=document.createElement('button');pauseButton.className='portals-pause-button';pauseButton.textContent='Pause';pauseButton.onclick=()=>setPaused(true);document.body.append(pauseButton);
 addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(overlay.hidden)setPaused(true);else back();}else if(!overlay.hidden&&e.key==='Tab'){const all=Array.from(overlay.querySelectorAll<HTMLElement>('button,input,select,a[href]')).filter(el=>visible(el)&&!(el as HTMLInputElement).disabled&&el.tabIndex>=0),i=all.indexOf(document.activeElement as HTMLElement);e.preventDefault();all[(i+(e.shiftKey?-1:1)+all.length)%all.length]?.focus();}},true);
 // Pause is manual. Window blur, tab visibility and controller connection
 // changes must never open the paused overlay or freeze the world clock.
 function adjust(target:HTMLElement,amount:number){
  if(target instanceof HTMLSelectElement){target.selectedIndex=Math.max(0,Math.min(target.options.length-1,target.selectedIndex+amount));target.dispatchEvent(new Event('change',{bubbles:true}));}
  else if(target instanceof HTMLInputElement){if(target.type==='range'||target.type==='number'){const step=Number(target.step)||1,min=target.min===''?-Infinity:Number(target.min),max=target.max===''?Infinity:Number(target.max);target.value=String(Math.max(min,Math.min(max,Number((Number(target.value)+step*amount).toFixed(6)))));target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));}else if(target.type==='checkbox'){target.click();}}
 }
 return {get paused(){return !overlay.hidden;},setPaused,addTab,poll(now:number):PortalPad{
  const pad=Array.from(gamepads()).find(p=>p?.connected&&p.mapping==='standard');
  const down=Array.from({length:17},(_,i)=>!!pad?.buttons[i]?.pressed),edge=(i:number)=>down[i]&&!previous[i];
  const dead=(v=0)=>Math.abs(v)<.18?0:Math.sign(v)*(Math.abs(v)-.18)/.82;
  const state=emptyPortalPad();
  if(edge(9))setPaused(overlay.hidden);
  if(!overlay.hidden){
   for(const tab of tabs){const enabled=tab.available();tab.button.disabled=!enabled;tab.pane.querySelectorAll<HTMLElement>('button,input,select').forEach(e=>{if(!enabled)e.setAttribute('data-world-unavailable','true');else e.removeAttribute('data-world-unavailable');});}
   if(edge(1))back();
   if(!settings.hidden&&(edge(4)||edge(5))){selectTab(tabIndex+(edge(5)?1:-1));}
   const direction=down[12]||dead(pad?.axes[1])<-.5?'up':down[13]||dead(pad?.axes[1])>.5?'down':down[14]||dead(pad?.axes[0])<-.5?'left':down[15]||dead(pad?.axes[0])>.5?'right':'';
   const target=document.activeElement as HTMLElement;
   if(direction&&(direction!==lastDirection||now>=repeatAt)){
    repeatAt=now+(direction!==lastDirection?380:110);
    if(editingText&&target instanceof HTMLInputElement){if(direction==='left'||direction==='right')caret=Math.max(0,Math.min(target.value.length,caret+(direction==='right'?1:-1)));else{const alphabet=' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',old=target.value[caret]??' ',i=alphabet.indexOf(old);target.value=target.value.slice(0,caret)+alphabet[(i+(direction==='up'?1:-1)+alphabet.length)%alphabet.length]+target.value.slice(caret+1);target.dispatchEvent(new Event('change',{bubbles:true}));}target.setSelectionRange(caret,caret+1);}
    else if(direction==='up'||direction==='down'){const all=items(),i=all.indexOf(target);all[(i+(direction==='down'?1:-1)+all.length)%all.length]?.focus();}
    else if(!target?.hasAttribute('data-world-unavailable')){adjust(target,direction==='right'?1:-1);if(visible(target))target.focus();}
    document.activeElement?.scrollIntoView({block:'nearest'});
   }
   lastDirection=direction;
   if(edge(0)&&!target?.hasAttribute('data-world-unavailable')){if(target instanceof HTMLInputElement&&target.type==='text'){editingText=!editingText;caret=0;}else if(target instanceof HTMLInputElement&&target.type==='checkbox')target.click();else if(target instanceof HTMLButtonElement||target instanceof HTMLAnchorElement)target.click();if(visible(target)&&!overlay.hidden)target.focus();}
  }else{
   state.active=down.some(Boolean)||Array.from(pad?.axes??[]).some(value=>dead(value)!==0);
   // LB dedicates the left stick to zoom, without accidentally moving Hero
   // or panning free camera. The paused branch keeps LB's tab-switch behavior.
   state.x=down[4]?0:dead(pad?.axes[0]);state.y=down[4]?0:-dead(pad?.axes[1]);state.zoom=down[4]?dead(pad?.axes[1]):0;state.lookX=dead(pad?.axes[2])+(down[15]?1:0)-(down[14]?1:0);state.lookY=dead(pad?.axes[3])+(down[13]?1:0)-(down[12]?1:0);
   state.sprint=down[0];state.jump=edge(1);state.jumpHeld=down[1];state.attack=edge(2);state.crouch=down[6];state.center=edge(5);state.interact=edge(3);
  }
  previous=down;return state;
 }};
}
