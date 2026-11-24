// The supplied film stays intact in its own render target. This envelope is the
// physical page and camera journey through the dot, before and after that film.
import {createBookPaper} from './shared-paper/bookPaper.js';
export async function createBelieveEnvelope(api){
 const {THREE:T,FullScreenQuad,renderer:r}=api,END=181,FILM_START=14,FILM_END=134,RETURN_END=146,RISE_END=151;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
 const ease=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10)},v=(x,y,z)=>new T.Vector3(x,y,z);
 const params=new URLSearchParams(location.search),scene=new T.Scene();scene.background=new T.Color('#080a10');scene.fog=new T.FogExp2('#080a10',.012);
 const cam=new T.PerspectiveCamera(39,innerWidth/innerHeight,.003,200),book=new T.Group();scene.add(book);
 cam.position.set(13,15,20);cam.lookAt(0,0,0);
 const standard=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.86,...extra});
 const paper=standard('#e6d9b5'),leaves=standard('#b8aa88'),leather=standard('#642c32'),gold=standard('#c5a264',{metalness:.65,roughness:.4});
 function mesh(parent,geo,mat,p){const m=new T.Mesh(geo,mat);if(p)m.position.copy(p);parent.add(m);m.castShadow=m.receiveShadow=true;return m;}
 function box(parent,w,h,d,mat,p){return mesh(parent,new T.BoxGeometry(w,h,d),mat,p);}
 const W=5.9,D=8.1;
 // The left cover hinges across the spine, so the same book opens and closes.
 box(book,W+.2,.12,D+.2,leather,v(W/2,.06,0));box(book,W,.22,D,leaves,v(W/2,.23,0));box(book,W,.028,D,paper,v(W/2,.355,0));
 const hinge=new T.Group();hinge.position.y=.36;book.add(hinge);
 box(hinge,W,.22,D,leaves,v(-W/2,-.125,0));box(hinge,W+.2,.12,D+.2,leather,v(-W/2,-.3,0));box(hinge,W,.028,D,paper,v(-W/2,.014,0));
 box(book,.09,.18,D+.15,leather,v(0,.13,0));
 // The game's shared Cold Press field/relief/color baker, cached once at load.
 const sharedPaper=createBookPaper(r,undefined,768);paper.map=sharedPaper.left;paper.needsUpdate=true;
 let seed=2323;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296};
 // Engraved foil on the outside of the hinged cover.
 const cc=document.createElement('canvas');cc.width=768;cc.height=1024;const cx=cc.getContext('2d');cx.fillStyle='#693239';cx.fillRect(0,0,768,1024);
 for(let i=0;i<12000;i++){cx.fillStyle='rgba(25,10,17,.035)';cx.fillRect(rand()*768,rand()*1024,2,2)}
 cx.strokeStyle='#b99b60';cx.lineWidth=3;cx.strokeRect(42,42,684,940);cx.lineWidth=1;cx.strokeRect(53,53,662,918);
 cx.beginPath();cx.ellipse(384,512,177,211,0,0,Math.PI*2);cx.stroke();cx.fillStyle='#c4a76e';cx.textAlign='center';cx.font='italic 74px Georgia';cx.fillText('Believe',384,535);
 for(const [x,z]of[[83,85],[685,85],[83,939],[685,939]]){cx.beginPath();cx.arc(x,z,16,0,Math.PI*2);cx.stroke();}
 const ct=new T.CanvasTexture(cc);ct.colorSpace=T.SRGBColorSpace;
 const cover=mesh(hinge,new T.PlaneGeometry(W+.18,D+.18),standard('#ffffff',{map:ct,metalness:.25,roughness:.6}),v(-W/2,-.365,0));cover.rotation.set(Math.PI/2,0,Math.PI);
 const text=document.createElement('canvas');text.width=1536;text.height=384;const tx=text.getContext('2d');tx.font='italic bold 250px Georgia';tx.fillStyle='#c6a25c';tx.fillText('Believe.',30,290);
 const tt=new T.CanvasTexture(text);tt.colorSpace=T.SRGBColorSpace;
 const ink=standard('#e2c787',{map:tt,transparent:true,metalness:.55,roughness:.32,depthWrite:false});
 const shimmerTime={value:0};ink.onBeforeCompile=shader=>{shader.uniforms.believeTime=shimmerTime;shader.fragmentShader='uniform float believeTime;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat sheen=pow(max(0.,1.-abs(fract(vMapUv.x*.65-believeTime*.12)-.5)*9.),3.);totalEmissiveRadiance+=vec3(1.,.76,.32)*sheen*.85;');};
 const word=mesh(hinge,new T.PlaneGeometry(3.9,.975),ink,v(-3.65,.034,-2.55));word.rotation.x=-Math.PI/2;word.castShadow=false;
 // Locate the i's isolated dot in the rendered type, preserving exact font spacing.
 const start=30+tx.measureText('Bel').width,finish=start+tx.measureText('i').width,im=tx.getImageData(0,0,1536,384).data;
 let sx=0,sy=0,n=0;for(let y=45;y<145;y++)for(let x=Math.floor(start);x<Math.ceil(finish);x++)if(im[(y*1536+x)*4+3]>100){sx+=x;sy+=y;n++;}
 const dotLocal=v(-3.65+((n?sx/n:515)/1536-.5)*3.9,.044,-2.55+((n?sy/n:102)/384-.5)*.975),dotWorld=dotLocal.clone();dotWorld.y+=.36;
 let filmTarget=new T.WebGLRenderTarget(2,2,{depthBuffer:false});filmTarget.texture.colorSpace=T.NoColorSpace;
 const portalMat=new T.ShaderMaterial({uniforms:{film:{value:filmTarget.texture},amount:{value:0},time:{value:0},resolution:{value:new T.Vector2(1,1)}},vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D film;uniform float amount,time;uniform vec2 resolution;varying vec2 q;void main(){vec2 p=q-.5;float d=length(p);if(d>.5)discard;vec3 c=texture2D(film,gl_FragCoord.xy/resolution).rgb;vec3 foil=vec3(.84,.69,.37)*(1.+.25*sin(time*1.7));gl_FragColor=vec4(mix(foil,c,amount),1.);}`});
 const portal=mesh(hinge,new T.PlaneGeometry(.135,.135),portalMat,dotLocal);portal.rotation.x=-Math.PI/2;portal.castShadow=false;
 // The desk supports the wrapper book without introducing any network assets.
 const wood=document.createElement('canvas');wood.width=1024;wood.height=512;const wx=wood.getContext('2d');wx.fillStyle='#30232a';wx.fillRect(0,0,1024,512);
 for(let i=0;i<2200;i++){const y=rand()*512;wx.strokeStyle=`rgba(${rand()>.5?'92,68,57':'10,8,17'},${.02+rand()*.07})`;wx.beginPath();wx.moveTo(0,y);wx.bezierCurveTo(300,y+rand()*8,700,y-rand()*8,1024,y);wx.stroke();}
 const wt=new T.CanvasTexture(wood);wt.colorSpace=T.SRGBColorSpace;wt.wrapS=wt.wrapT=T.RepeatWrapping;wt.repeat.set(80,80);const deskMat=standard('#ffffff',{map:wt});box(scene,2000,.6,2000,deskMat,v(0,-.36,0));
 const amb=new T.HemisphereLight('#d0dcf4','#37232b',1.4);scene.add(amb);
 const key=new T.DirectionalLight('#ffebcb',2.4);key.position.set(-5,14,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-15;key.shadow.camera.right=15;key.shadow.camera.top=15;key.shadow.camera.bottom=-15;key.shadow.normalBias=.03;scene.add(key);
 const rim=new T.DirectionalLight('#9badcf',.8);rim.position.set(6,8,-9);scene.add(rim);
 r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
 const copy=new FullScreenQuad(new T.ShaderMaterial({uniforms:{image:{value:filmTarget.texture}},vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D image;varying vec2 q;void main(){gl_FragColor=texture2D(image,q);}',depthTest:false,depthWrite:false}));
 const white=new FullScreenQuad(new T.ShaderMaterial({uniforms:{alpha:{value:0}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform float alpha;void main(){gl_FragColor=vec4(1.,.98,.91,alpha);}',transparent:true,depthTest:false,depthWrite:false}));
 const returnCam=api.filmCamera(),gatePos=returnCam.pos.clone().add(v(-12,6,44)),gate=new T.Group();gate.position.copy(gatePos);gate.lookAt(returnCam.pos);api.worldScene.add(gate);gate.visible=false;
 mesh(gate,new T.CircleGeometry(2,48),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide}),v(0,0,0));
 const glow=mesh(gate,new T.RingGeometry(2,2.5,64),new T.MeshBasicMaterial({color:'#efd7a1',transparent:true,opacity:.25,side:T.DoubleSide}),v(0,0,0));glow.castShadow=false;
 const ui=document.createElement('div');ui.id='believe-transport';ui.innerHTML='<button id="believe-play" type="button" disabled aria-label="Play Believe">Preparing…</button><input id="believe-progress" type="range" min="0" max="181" step=".1" value="0" aria-label="Film position"><output>0:00 / 3:01</output>';document.body.append(ui);
 const css=document.createElement('style');css.textContent='#believe-transport{position:fixed;z-index:11;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:10px 15px;border:1px solid #bba17466;border-radius:30px;background:#101018b8;color:#eedcba;font:12px Georgia;backdrop-filter:blur(12px);max-width:calc(100vw - 125px);transition:opacity .5s}body[data-playing=true] #believe-transport{opacity:0}body[data-playing=true] #believe-transport:hover,body[data-playing=true] #believe-transport:focus-within{opacity:1}#believe-transport button{border:0;background:none;color:inherit;font:14px Georgia;min-width:62px;cursor:pointer}#believe-transport button:disabled{opacity:.5;cursor:wait}#believe-progress{width:min(25vw,240px);accent-color:#c6a25c}#believe-transport output{white-space:nowrap}canvas{outline:none}';document.head.append(css);
 const play=ui.querySelector('button'),progress=ui.querySelector('input'),clock=ui.querySelector('output');
 let time=0,playing=false,ready=false,last=performance.now(),lastPhase='',needsDraw=true;
 function phase(t){return t<5?'opening':t<FILM_START?'entering-dot':t<FILM_END?'film':t<RETURN_END?'returning-to-dot':t<RISE_END?'emerging':t<END?'closing':'complete'}
 const post=data=>parent.postMessage(data,location.origin),format=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
 function state(){document.body.dataset.phase=phase(time);document.body.dataset.time=time.toFixed(2);document.body.dataset.playing=String(playing);play.textContent=time>=END?'Replay':playing?'Pause':'Play';play.setAttribute('aria-label',time>=END?'Replay Believe':playing?'Pause Believe':'Play Believe');progress.value=String(time);clock.textContent=`${format(time)} / 3:01`;if(lastPhase!==phase(time)){lastPhase=phase(time);post({type:'believe:state',phase:lastPhase,time,playing});}}
 function setPlaying(on){if(!ready)return;if(on&&time>=END)seek(0);playing=on;last=performance.now();api.setSound(on&&Boolean(window.__penAudio?.want));state();}
 function seek(t){time=clamp(Number(t)||0,0,END);api.seekAudio(clamp(time-FILM_START,0,120));needsDraw=true;render();state();}
 play.onclick=()=>setPlaying(!playing);progress.oninput=()=>seek(progress.value);
 addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|BUTTON/.test(document.activeElement?.tagName)){e.preventDefault();setPlaying(!playing)}});
 addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;if(e.data?.type==='believe:seek')seek(e.data.time);if(e.data?.type==='believe:play')setPlaying(true);if(e.data?.type==='believe:pause')setPlaying(false)});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false)});
 function targetSize(){const size=r.getDrawingBufferSize(new T.Vector2());portalMat.uniforms.resolution.value.copy(size);if(filmTarget.width!==size.x||filmTarget.height!==size.y)filmTarget.setSize(size.x,size.y);}
 function outerPose(t){
  let open=1; if(t<5)open=ease(t/5);else if(t>171)open=1-ease((t-171)/10);hinge.rotation.z=-Math.PI*(1-open);
  cam.aspect=innerWidth/innerHeight;cam.fov=innerWidth<innerHeight?54:39;cam.near=.003;cam.far=200;cam.updateProjectionMatrix();
  let p,target;
  if(t<5){p=v(13,15,20);target=v(mix(2.95,0,ease(t/5)),.3,0)}
  else if(t<FILM_START){const u=ease((t-5)/9);p=v(13,15,20).lerp(dotWorld.clone().add(v(0,.012,0)),u);target=v(0,.35,0).lerp(dotWorld,u);}
  else if(t<RISE_END){const u=ease((t-RETURN_END)/5);p=dotWorld.clone().add(v(0,.012,0)).lerp(v(0,18,10),u);const upTarget=dotWorld.clone().add(v(0,2,-.01)),downTarget=v(0,.3,0);target=upTarget.lerp(downTarget,ease(clamp((t-RETURN_END-1.3)/3.7)));}
  else{const u=clamp((t-RISE_END)/30),s=ease(u),a=s*Math.PI*2;p=v(mix(0,2.95,s)+Math.sin(a)*mix(10,20,s),mix(18,15,s),Math.cos(a)*mix(10,20,s));target=v(mix(0,2.95,s),.3,0)}
  cam.position.copy(p);cam.up.set(0,1,0);cam.lookAt(target);cam.updateMatrixWorld();
  const shimmer=1+.16*Math.sin(t*1.4);ink.emissive.set('#b99345');ink.emissiveIntensity=.13*shimmer;shimmerTime.value=t;portalMat.uniforms.time.value=t;
 }
 function render(){
  targetSize();const inside=time>=FILM_START&&time<RETURN_END;
  if(time>=5&&time<RETURN_END){
   let override=null;gate.visible=time>=FILM_END;
   if(gate.visible){const u=clamp((time-FILM_END)/3),move=ease((time-FILM_END-3)/9),p=returnCam.pos.clone().lerp(gatePos.clone().lerp(returnCam.pos,.0004),move);
    const from=returnCam.tgt.clone().sub(returnCam.pos).normalize(),to=gatePos.clone().sub(returnCam.pos).normalize(),q=new T.Quaternion().setFromUnitVectors(from,to),dir=from.clone().applyQuaternion(new T.Quaternion().slerp(q,ease(u)));override={pos:p,tgt:p.clone().add(dir),near:.003,ap:0,focus:2};
   }
   r.outputColorSpace=T.LinearSRGBColorSpace;api.drawFilm(clamp(time-FILM_START,0,120),filmTarget,override);
  }else gate.visible=false;
  r.setRenderTarget(null);
  if(inside){copy.render(r)}else{outerPose(time);portalMat.uniforms.amount.value=time>5&&time<RETURN_END?1:0;r.outputColorSpace=T.SRGBColorSpace;r.setClearColor(scene.background,1);r.clear();r.render(scene,cam);}
  // A short glare as the luminous dot passes the lens hides the two scales' seam.
  const flash=time>=RETURN_END&&time<RETURN_END+.65?1-ease((time-RETURN_END)/.65):0;
  if(flash){white.material.uniforms.alpha.value=flash;white.render(r)}
  needsDraw=false;
 }
 await api.warm(value=>post({type:'believe:progress',value:.15+.7*value,label:'Preparing the pop-up worlds'}));
 if(window.__penAudio)window.__penAudio.set=on=>api.setSound(on&&playing);
 await r.compileAsync(scene,cam);targetSize();render();
 // Prepare the wrapper's physical closure and portal shaders before the button works.
 for(const t of[4,10,146,176,181]){time=t;render();await new Promise(resolve=>setTimeout(resolve,0))}time=0;render();
 ready=true;play.disabled=false;document.body.dataset.ready='true';document.getElementById('poster')?.remove();state();post({type:'believe:ready',duration:END});
 window.__believe={seek,play:()=>setPlaying(true),pause:()=>setPlaying(false),get time(){return time},get playing(){return playing},get phase(){return phase(time)},get open(){return 1+hinge.rotation.z/Math.PI},get dot(){return dotWorld.toArray()},renderer:r,scene,cam,filmTarget};
 addEventListener('resize',()=>{needsDraw=true;last=performance.now()});
 if(params.has('t'))seek(params.get('t'));
 r.setAnimationLoop(()=>{const now=performance.now(),dt=(now-last)/1000;last=now;if(playing){time=Math.min(END,time+Math.min(dt,.05));render();if(time>=END)setPlaying(false);if(time>=FILM_START&&time<FILM_END)api.adaptFilm(dt);state();}else if(needsDraw)render();});
}
