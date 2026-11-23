import * as THREE from 'three';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import {freshWorldStudioDocument,validWorldStudioDocument,STUDIO_ATMOSPHERE_DEFAULTS,type WorldStudioDocument,type StudioShot} from './worldStudioDocument';
import type {createWorldStudioEngine} from './worldStudioEngine';
import './worldStudio.css';

type Engine=ReturnType<typeof createWorldStudioEngine>;
type Adapter={canvas:HTMLCanvasElement;camera:THREE.PerspectiveCamera;scene:THREE.Scene;ground:THREE.Mesh;engine:Engine;initial:WorldStudioDocument;free():void;ready():boolean;frame(shot:StudioShot):void;changed(doc:WorldStudioDocument):void};
const studioId=()=>globalThis.crypto?.randomUUID?.()??`world-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
/** The document contains authoring values only. Hero, arrival, navigation,
 * combat and session progress never enter disk saves or exported recipes. */
export async function createWorldStudio(a:Adapter){
 const page=a.initial.page,endpoint=`/__world-studio${page}`,draftKey=`exploritaire.world${page}.draft`;
 let doc=structuredClone(a.initial),diskRevision=doc.revision,diskAvailable=false,committed=structuredClone(doc),selected='',tool='navigate',placing:'tree'|'rock'|undefined,painting=false,lastBrush=0,dirty=false;
 const undo:WorldStudioDocument[]=[],redo:WorldStudioDocument[]=[];
 const toggle=document.createElement('button');toggle.type='button';toggle.className='world-studio-toggle';toggle.textContent='World Studio';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','world-studio');document.body.append(toggle);
 const panel=document.createElement('aside');panel.id='world-studio';panel.className='world-studio';panel.hidden=true;panel.setAttribute('aria-label',`Page ${page} World Studio`);
 panel.innerHTML=`<header><div><strong>World Studio</strong><span>Page ${page} · paint experiment</span></div><button type="button" data-action="close" aria-label="Close World Studio">×</button></header>
 <nav class="studio-tabs" aria-label="World tools"><button type="button" data-tab="paint">Paint</button><button type="button" data-tab="ground">Ground</button><button type="button" data-tab="objects">Objects</button><button type="button" data-tab="camera">Camera</button></nav>
 <div class="studio-content"><section data-pane="paint"></section><section data-pane="ground" hidden></section><section data-pane="objects" hidden></section><section data-pane="camera" hidden></section></div>
 <footer><div class="studio-actions"><button type="button" data-action="undo">Undo</button><button type="button" data-action="redo">Redo</button><button type="button" data-action="save">Save to disk</button><button type="button" data-action="load">Reload disk</button></div>
 <div class="studio-actions"><button type="button" data-action="export">Export</button><button type="button" data-action="import">Import</button><button type="button" data-action="restore" hidden>Restore draft</button><button type="button" data-action="reset">Reset draft</button></div><p class="studio-status" role="status"></p></footer>`;
 document.body.append(panel);
 const pane=(name:string)=>panel.querySelector<HTMLElement>(`[data-pane="${name}"]`)!;
 const status=(message:string)=>{panel.querySelector('.studio-status')!.textContent=message;};
 const action=(name:string)=>panel.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
 const controls=new Map<string,HTMLInputElement|HTMLSelectElement>();
 function apply(){a.engine.apply(doc);a.changed(doc);dirty=true;status('Unsaved preview · Save to disk to keep it on every device.');}
 function refresh(){
  doc.atmosphere??={...STUDIO_ATMOSPHERE_DEFAULTS};
  for(const [path,input]of controls){const [group,key]=path.split('.');const value=(doc[group as 'paint'|'ground'|'atmosphere'] as unknown as Record<string,unknown>)[key];if(input instanceof HTMLInputElement&&input.type==='checkbox')input.checked=Boolean(value);else input.value=String(value);if(group==='atmosphere'&&key!=='smokeWisps')input.disabled=!doc.atmosphere.smokeWisps;const output=input.parentElement?.querySelector('output');if(output)output.textContent=typeof value==='number'?String(Math.round(value*100)/100):String(value);}
  action('undo').disabled=!undo.length;action('redo').disabled=!redo.length;refreshObjects();refreshShots();
 }
 function remember(){try{localStorage.setItem(draftKey,JSON.stringify({document:doc,baseRevision:diskRevision}));}catch{/* Disk/export remain available. */}}
 function commit(change?:()=>void){
  if(change)change();if(JSON.stringify(doc)===JSON.stringify(committed))return true;
  try{apply();}catch(error){doc=structuredClone(committed);a.engine.apply(doc);a.changed(doc);refresh();status(`Preview rejected: ${String(error)}`);return false;}
  undo.push(committed);if(undo.length>40)undo.shift();redo.length=0;committed=structuredClone(doc);remember();refresh();return true;
 }
 function edit(path:string,value:unknown,preview=false){doc.atmosphere??={...STUDIO_ATMOSPHERE_DEFAULTS};const [group,key]=path.split('.');(doc[group as 'paint'|'ground'|'atmosphere'] as unknown as Record<string,unknown>)[key]=value;if(preview)apply();else commit();}
 function range(target:HTMLElement,path:string,label:string,min:number,max:number,step:number){
  const row=document.createElement('label');row.className='studio-range';row.innerHTML=`<span>${label}</span><output></output><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}">`;const input=row.querySelector('input')!;controls.set(path,input);input.oninput=()=>{edit(path,Number(input.value),true);row.querySelector('output')!.textContent=input.value;};input.onchange=()=>commit();target.append(row);
 }
 function button(target:HTMLElement,label:string,handler:()=>void){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=handler;target.append(b);return b;}
 const paintPane=pane('paint');paintPane.innerHTML='<p>Surface-pinned brush marks stay with the world as the camera moves.</p>';
 const enabled=document.createElement('label');enabled.className='studio-check';enabled.innerHTML='<input type="checkbox"> Painted marks';controls.set('paint.enabled',enabled.querySelector('input')!);enabled.querySelector('input')!.onchange=e=>edit('paint.enabled',(e.target as HTMLInputElement).checked);paintPane.append(enabled);
 const palette=document.createElement('label');palette.textContent='Palette';const palettes=document.createElement('select');palettes.setAttribute('aria-label','Palette');for(const [value,text]of [['autumn-wood','Autumn Wood'],['darker-autumn','Darker Autumn'],['grove','Grove watercolor'],['ochre','Warm underpaint'],['moonlit','Moonlit washes']]){const o=new Option(text,value);palettes.add(o);}palette.append(palettes);controls.set('paint.palette',palettes);palettes.onchange=()=>edit('paint.palette',palettes.value);paintPane.append(palette);
 range(paintPane,'paint.size','Brush size',.25,4,.05);range(paintPane,'paint.coverage','Stroke coverage',0,1,.01);range(paintPane,'paint.relief','Paint relief',0,.6,.01);range(paintPane,'paint.variation','Color variation',0,.5,.01);
 const seed=document.createElement('label');seed.textContent='Paint and planting seed';const seedInput=document.createElement('input');seedInput.type='number';seedInput.min='1';seedInput.max='99999';seedInput.setAttribute('aria-label','Paint and planting seed');seed.append(seedInput);controls.set('paint.seed',seedInput);seedInput.onchange=()=>edit('paint.seed',Math.max(1,Math.min(99999,Math.round(Number(seedInput.value)||1110))));paintPane.append(seed);
 button(paintPane,'New brush / planting seed',()=>commit(()=>{doc.paint.seed=1+Math.floor(Math.random()*99998);}));
 const sources=document.createElement('p');sources.className='studio-sources';sources.innerHTML='Methods: <a href="https://patch.gg/blendi/oil-paint" target="_blank" rel="noreferrer">Oil Paint</a> · <a href="https://patch.gg/patch/soil-and-grass" target="_blank" rel="noreferrer">Soil and Grass</a>';paintPane.append(sources);
 const groundPane=pane('ground');groundPane.innerHTML='<p>Curled, wind-blown blades follow the same triangle surface as the soil.</p>';
 const atmosphere=document.createElement('div');atmosphere.className='studio-atmosphere';atmosphere.innerHTML='<h3>Ground mist & smoke</h3><p>The grove stays bright, with low mist and fog around the perimeter and waterfall.</p>';
 const smokeToggle=document.createElement('label');smokeToggle.className='studio-check';smokeToggle.innerHTML='<input type="checkbox" aria-label="Smoke wisps"> Smoke wisps';controls.set('atmosphere.smokeWisps',smokeToggle.querySelector('input')!);smokeToggle.querySelector('input')!.onchange=e=>edit('atmosphere.smokeWisps',(e.target as HTMLInputElement).checked);atmosphere.append(smokeToggle);
 range(atmosphere,'atmosphere.smokeDensity','Smoke density',0,1,.05);range(atmosphere,'atmosphere.buoyancy','Smoke rise',0,6,.1);range(atmosphere,'atmosphere.swirl','Smoke swirl',0,1,.05);
 const smokeSource=document.createElement('p');smokeSource.className='studio-sources';smokeSource.innerHTML='Smoke motion adapted from <a href="https://patch.gg/patch/particle-physics" target="_blank" rel="noreferrer">Particle Physics</a>.';atmosphere.append(smokeSource);groundPane.append(atmosphere);
 range(groundPane,'ground.density','Grass density',0,1,.01);range(groundPane,'ground.height','Blade height',.1,1.4,.05);range(groundPane,'ground.width','Blade width',.015,.15,.005);range(groundPane,'ground.curl','Curl',0,2.5,.05);range(groundPane,'ground.wind','Wind',0,1.5,.05);range(groundPane,'ground.moss','Moss cover',0,1,.01);range(groundPane,'ground.wetness','Damp soil',0,1,.01);
 const brushMode=document.createElement('label');brushMode.textContent='Ground brush';const modes=document.createElement('select');modes.setAttribute('aria-label','Ground brush');for(const [v,t]of [['navigate','Navigate'],['grow','Grow grass'],['erase','Clear a path'],['wet','Wet soil'],['dry','Dry soil']])modes.add(new Option(t,v));brushMode.append(modes);modes.onchange=()=>{placing=undefined;tool=modes.value;gizmo.detach();a.free();status(tool==='navigate'?'Camera navigation active.':'Drag on the ground to paint. Undo restores the whole stroke.');};groundPane.append(brushMode);
 let brushRadius=12;const radius=document.createElement('label');radius.textContent='Brush radius';const radiusInput=document.createElement('input');radiusInput.type='range';radiusInput.min='4';radiusInput.max='35';radiusInput.step='1';radiusInput.value='12';radiusInput.setAttribute('aria-label','Ground brush radius');radiusInput.oninput=()=>{brushRadius=Number(radiusInput.value);};radius.append(radiusInput);groundPane.append(radius);
 const fieldView=document.createElement('canvas');fieldView.width=fieldView.height=192;fieldView.className='studio-field';fieldView.setAttribute('aria-label','Growth and wetness field preview');groundPane.append(fieldView);
 const objectPane=pane('objects');objectPane.innerHTML='<p>Add trees and rocks on supported ground. Drag the selected object’s handles or use its coordinates.</p>';
 const objectActions=document.createElement('div');objectActions.className='studio-actions';objectPane.append(objectActions);
 for(const kind of ['tree','rock']as const)button(objectActions,`Place ${kind}`,()=>{placing=kind;tool='place';modes.value='navigate';gizmo.detach();a.free();status(`Click dry ground to place a ${kind}. Escape cancels.`);});
 const list=document.createElement('select');list.size=5;list.setAttribute('aria-label','Authored objects');objectPane.append(list);
 const transformActions=document.createElement('div');transformActions.className='studio-actions';objectPane.append(transformActions);
 button(transformActions,'Move handles',()=>{gizmo.setMode('translate');gizmo.showX=gizmo.showY=gizmo.showZ=true;});button(transformActions,'Turn handles',()=>{gizmo.setMode('rotate');gizmo.showX=gizmo.showZ=false;gizmo.showY=true;});
 const inspector=document.createElement('div');inspector.className='studio-transform';objectPane.append(inspector);
 const propInputs=new Map<string,HTMLInputElement>();
 for(const key of ['name','x','y','z','yaw','scale']){const label=document.createElement('label');label.textContent=key==='yaw'?'Turn °':key==='scale'?'Size':key.toUpperCase();const input=document.createElement('input');input.type=key==='name'?'text':'number';input.step=key==='yaw'?'1':'.1';input.setAttribute('aria-label',`Object ${key}`);if(key==='name')input.maxLength=100;label.append(input);inspector.append(label);propInputs.set(key,input);input.onchange=()=>{
  const p=doc.props.find(p=>p.id===selected);if(!p)return;
  commit(()=>{if(key==='name')p.name=input.value.trim()||p.kind;else if(['x','y','z'].includes(key))p.position[['x','y','z'].indexOf(key)]=THREE.MathUtils.clamp(Number(input.value)||0,-2000,2000);else if(key==='yaw')p.yaw=THREE.MathUtils.clamp(Number(input.value)||0,-360,360);else p.scale=THREE.MathUtils.clamp(Number(input.value)||1,.15,6);});
 };}
 const moreObjects=document.createElement('div');moreObjects.className='studio-actions';objectPane.append(moreObjects);
 button(moreObjects,'Snap to ground',()=>commit(()=>{const p=doc.props.find(p=>p.id===selected);if(p)p.position[1]=a.engine.height(p.position[0],p.position[2]);}));
 button(moreObjects,'Duplicate',()=>commit(()=>{const p=doc.props.find(p=>p.id===selected);if(p&&doc.props.length<200){const copy=structuredClone(p);copy.id=studioId();copy.name+=' copy';copy.position[0]+=4;copy.position[1]=a.engine.height(copy.position[0],copy.position[2]);doc.props.push(copy);selected=copy.id;}}));
 button(moreObjects,'Delete',()=>commit(()=>{doc.props=doc.props.filter(p=>p.id!==selected);selected='';}));
 const cameraPane=pane('camera');cameraPane.innerHTML='<p>Capture and revisit a composition without moving Hero.</p>';
 const overview=()=>a.frame({id:'studio-overview',name:'Grove overview',position:[65,80,140],target:[0,8,25],fov:55});
 button(cameraPane,'Grove overview',overview);button(objectActions,'Grove overview',overview);
 const telemetry=document.createElement('p');telemetry.className='studio-telemetry';cameraPane.append(telemetry);
 button(cameraPane,'Capture camera shot',()=>commit(()=>{if(doc.shots.length>=40)return;const direction=a.camera.getWorldDirection(new THREE.Vector3()),target=a.camera.position.clone().addScaledVector(direction,20);doc.shots.push({id:studioId(),name:`View ${doc.shots.length+1}`,position:a.camera.position.toArray(),target:target.toArray(),fov:a.camera.fov});}));
 const shotList=document.createElement('select');shotList.size=5;shotList.setAttribute('aria-label','Camera shots');cameraPane.append(shotList);
 const shotActions=document.createElement('div');shotActions.className='studio-actions';cameraPane.append(shotActions);
 button(shotActions,'Go to shot',()=>{const shot=doc.shots.find(s=>s.id===shotList.value);if(shot)a.frame(shot);});button(shotActions,'Delete shot',()=>commit(()=>{doc.shots=doc.shots.filter(s=>s.id!==shotList.value);}));
 const gizmo=new TransformControls(a.camera,a.canvas);gizmo.setSpace('world');gizmo.setTranslationSnap(.25);gizmo.setRotationSnap(THREE.MathUtils.degToRad(5));gizmo.setSize(.8);a.scene.add(gizmo.getHelper());gizmo.enabled=false;
 function attach(){gizmo.detach();const object=a.engine.props.children.find(o=>o.userData.studioId===selected);if(object&&!panel.hidden&&!pane('objects').hidden&&tool==='navigate'){gizmo.enabled=true;gizmo.attach(object);}else gizmo.enabled=false;}
 gizmo.addEventListener('dragging-changed',event=>{if(event.value){a.free();painting=false;}else{
  const object=gizmo.object,p=doc.props.find(p=>p.id===selected);if(!object||!p)return;
  commit(()=>{p.position=object.position.toArray();p.yaw=THREE.MathUtils.radToDeg(object.rotation.y)%360;});
 }});
 function refreshObjects(){
  list.replaceChildren();for(const p of doc.props)list.add(new Option(`${p.name} · ${p.kind}`,p.id));list.value=selected;
  const p=doc.props.find(p=>p.id===selected);for(const [key,input]of propInputs){input.disabled=!p;if(p)input.value=String(key==='name'?p.name:key==='yaw'?p.yaw:key==='scale'?p.scale:p.position[['x','y','z'].indexOf(key)]);else input.value='';}attach();
 }
 list.onchange=()=>{selected=list.value;tool='navigate';placing=undefined;a.free();refreshObjects();};
 function refreshShots(){const previous=shotList.value;shotList.replaceChildren();for(const shot of doc.shots)shotList.add(new Option(shot.name,shot.id));shotList.value=doc.shots.some(s=>s.id===previous)?previous:doc.shots[0]?.id??'';}
 for(const tab of panel.querySelectorAll<HTMLButtonElement>('[data-tab]'))tab.onclick=()=>{for(const p of panel.querySelectorAll<HTMLElement>('[data-pane]'))p.hidden=p.dataset.pane!==tab.dataset.tab;for(const b of panel.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b===tab));tool='navigate';placing=undefined;modes.value='navigate';if(tab.dataset.tab!=='objects')gizmo.detach();else attach();};
 panel.querySelector('[data-tab="paint"]')!.setAttribute('aria-pressed','true');
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),circleGeometry=new THREE.BufferGeometry(),circlePoints=new Float32Array(64*3);
 circleGeometry.setAttribute('position',new THREE.BufferAttribute(circlePoints,3));const circle=new THREE.LineLoop(circleGeometry,new THREE.LineBasicMaterial({color:'#f0dba4',transparent:true,opacity:.8,depthWrite:false}));circle.visible=false;a.scene.add(circle);
 function hit(event:PointerEvent){const r=a.canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);ray.setFromCamera(pointer,a.camera);return ray.intersectObject(a.ground,false)[0]?.point;}
 function dab(event:PointerEvent){
  const p=hit(event);if(!p)return;for(let i=0;i<64;i++){const angle=i/64*Math.PI*2,x=p.x+Math.cos(angle)*brushRadius,z=p.z+Math.sin(angle)*brushRadius;circlePoints.set([x,a.engine.height(x,z)+.1,z],i*3);}circleGeometry.attributes.position.needsUpdate=true;circleGeometry.computeBoundingSphere();circle.visible=true;
  if(!painting||performance.now()-lastBrush<35)return;lastBrush=performance.now();a.engine.field.brush(p.x,p.z,brushRadius,tool==='grow'||tool==='erase'?'growth':'wet',tool==='grow'||tool==='wet'?1:0,.35);
 }
 a.canvas.addEventListener('pointerdown',event=>{
  if(panel.hidden||!a.ready())return;
  if(placing){event.preventDefault();event.stopImmediatePropagation();const p=hit(event);if(!p)return;if(!a.engine.canPlace(p.x,p.z)){status('Choose dry, supported ground for this object.');return;}commit(()=>{if(doc.props.length>=200)return;selected=studioId();doc.props.push({id:selected,name:`${placing==='tree'?'Tree':'Rock'} ${doc.props.length+1}`,kind:placing!,position:[p.x,a.engine.height(p.x,p.z),p.z],yaw:0,scale:1});});placing=undefined;tool='navigate';return;}
  if(['grow','erase','wet','dry'].includes(tool)){event.preventDefault();event.stopImmediatePropagation();painting=true;a.canvas.setPointerCapture(event.pointerId);dab(event);return;}
  if(gizmo.axis||gizmo.dragging)return;
  if(!pane('objects').hidden){hit(event);const picked=ray.intersectObject(a.engine.props,true)[0]?.object;let group:THREE.Object3D|undefined=picked;while(group&&group.parent!==a.engine.props)group=group.parent??undefined;if(group){event.preventDefault();event.stopImmediatePropagation();selected=String(group.userData.studioId);refreshObjects();}}
 },true);
 a.canvas.addEventListener('pointermove',event=>{if(!panel.hidden&&['grow','erase','wet','dry'].includes(tool)){event.stopImmediatePropagation();dab(event);}},true);
 // Controller-accessible counterparts to direct ground clicks. The same pick,
 // dry-ground validation, field write and undo path remain authoritative.
 if(location.pathname.endsWith('/portals.html')){
  button(objectActions,'Place at view center',()=>{if(!placing){status('Choose Place tree or Place rock first.');return;}const r=a.canvas.getBoundingClientRect();a.canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0,bubbles:true}));});
  button(groundPane,'Apply brush at view center',()=>{if(!['grow','erase','wet','dry'].includes(tool)){status('Select a ground brush first.');return;}const r=a.canvas.getBoundingClientRect();painting=true;lastBrush=0;dab(new PointerEvent('pointermove',{clientX:r.left+r.width/2,clientY:r.top+r.height/2}));painting=false;a.engine.field.write(doc);commit();});
 }
 const endStroke=(event:PointerEvent)=>{if(!painting)return;event.stopImmediatePropagation();painting=false;if(a.canvas.hasPointerCapture(event.pointerId))a.canvas.releasePointerCapture(event.pointerId);a.engine.field.write(doc);commit();};
 a.canvas.addEventListener('pointerup',endStroke,true);a.canvas.addEventListener('pointercancel',endStroke,true);
 function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');gizmo.detach();gizmo.enabled=false;circle.visible=false;tool='navigate';placing=undefined;}
 toggle.onclick=()=>{if(!a.ready()){status('Finish the arrival before editing.');return;}panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)a.free();else close();};action('close').onclick=close;
 action('undo').onclick=()=>{if(!undo.length)return;redo.push(structuredClone(doc));doc=undo.pop()!;committed=structuredClone(doc);apply();remember();refresh();};
 action('redo').onclick=()=>{if(!redo.length)return;undo.push(structuredClone(doc));doc=redo.pop()!;committed=structuredClone(doc);apply();remember();refresh();};
 action('reset').onclick=()=>commit(()=>{doc=freshWorldStudioDocument(page);doc.revision=diskRevision;selected='';});
 action('save').onclick=async()=>{action('save').disabled=true;try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:doc,baseRevision:diskRevision})});if(!r.ok)throw Error(await r.text());const saved=await r.json();if(!validWorldStudioDocument(saved,page))throw Error('Invalid save response');doc=saved;diskRevision=saved.revision;committed=structuredClone(doc);dirty=false;try{localStorage.removeItem(draftKey);}catch{/* Save already confirmed on disk. */}status(`Saved revision ${diskRevision} to disk.`);}catch(e){status(String(e));}finally{action('save').disabled=!diskAvailable;}};
 async function load(initial=false){try{const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw Error('Disk saving is unavailable here. Export keeps your recipe.');const data=await r.json();if(!validWorldStudioDocument(data,page))throw Error('World settings are invalid');diskRevision=data.revision;diskAvailable=true;if(initial){doc=data;committed=structuredClone(doc);a.engine.apply(doc);a.changed(doc);refresh();}else commit(()=>{doc=data;selected='';});dirty=false;status(`Loaded disk revision ${diskRevision}.`);}catch(e){status(initial?'Preview ready. Disk saving is unavailable here; use Export.':String(e));}action('save').disabled=!diskAvailable;}
 action('load').onclick=()=>{void load();};
 action('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`exploritaire-world-${page}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;panel.append(file);action('import').onclick=()=>file.click();file.onchange=async()=>{const selected=file.files?.[0];if(!selected)return;try{if(selected.size>1048576)throw Error('Import exceeds 1 MB');const parsed=JSON.parse(await selected.text());if(!validWorldStudioDocument(parsed,page))throw Error(`Not a valid page ${page} recipe`);commit(()=>{doc=parsed;doc.revision=diskRevision;});status('Imported as an unsaved preview.');}catch(e){status(String(e));}file.value='';};
 try{const draft=JSON.parse(localStorage.getItem(draftKey)??'null');if(validWorldStudioDocument(draft?.document,page)){action('restore').hidden=false;action('restore').onclick=()=>{commit(()=>{doc=draft.document;doc.revision=diskRevision;});action('restore').hidden=true;};}}catch{/* Ignore damaged optional drafts. */}
 addEventListener('keydown',event=>{if(panel.hidden)return;if(event.key==='Escape'){tool='navigate';placing=undefined;circle.visible=false;gizmo.detach();modes.value='navigate';return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!(event.target as HTMLElement).closest('input,textarea')){event.preventDefault();(event.shiftKey?action('redo'):action('undo')).click();}});
 let lastInfo=0;
 refresh();await load(true);
 return {close,embed(){toggle.hidden=true;panel.hidden=false;return {panel,tabs:Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-tab]'))};},open(){if(!a.ready())return;panel.hidden=false;toggle.setAttribute('aria-expanded','true');a.free();},overview,get ownsPointer(){return !panel.hidden&&(tool!=='navigate'||Boolean(gizmo.axis)||gizmo.dragging);},get document(){return structuredClone(doc);},update(now:number){toggle.disabled=!a.ready();if(panel.hidden||now-lastInfo<500)return;lastInfo=now;const p=a.camera.position;telemetry.textContent=`Position ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} · FOV ${a.camera.fov.toFixed(1)}°\n${a.engine.diagnostics.strokes.toLocaleString()} marks · ${a.engine.diagnostics.grass.toLocaleString()} blades${dirty?' · unsaved':''}`;
  const ctx=fieldView.getContext('2d')!,pixels=ctx.createImageData(64,64);for(let i=0;i<4096;i++){pixels.data[i*4]=38+70*a.engine.field.wet[i];pixels.data[i*4+1]=45+140*a.engine.field.growth[i];pixels.data[i*4+2]=45+170*a.engine.field.wet[i];pixels.data[i*4+3]=255;}const mini=document.createElement('canvas');mini.width=mini.height=64;mini.getContext('2d')!.putImageData(pixels,0,0);ctx.clearRect(0,0,192,192);ctx.drawImage(mini,0,0,192,192);
 }};
}
