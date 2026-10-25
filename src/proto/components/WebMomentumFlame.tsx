import {useEffect,useRef,useState,type ReactNode} from 'react';
import './WebMomentumFlame.css';
export const FLAME_STUDIES=[
 {name:'Ember Tongues',note:'Broad flame ribbons with irregular blooms, wandering tongues and leading-tail embers.'},
 {name:'Windcoil',note:'Wind-swept tips and torn overlapping ribbons, with drifting sparks at the live tail.'},
 {name:'Painted Vortex',note:'Layered rotating noise washes, inspired by the supplied shader. Soft pigment without uniform channels.'},
 {name:'Solar Filaments',note:'A bright coiled heart opens into translucent, curling flame sheets. Completed turns settle; the open front burns freely.'},
] as const;
const vertex=`attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}`;
// Original implementation informed by the user's three supplied studies: layered
// rotating/scaling noise, warm overlapping forms and negative-space flame cuts.
// No remote textures, recording helpers or full-screen render loop are required.
const fragment=`precision highp float;
uniform vec2 u_resolution;uniform float u_time;uniform float u_fill;uniform float u_variant;uniform float u_energy;uniform float u_bloom;uniform float u_seed;uniform float u_smoke;uniform float u_tailEmphasis;
#define TAU 6.28318530718
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+u_seed*31.71)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,w=.57;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<3;i++){s+=noise(p)*w;p=r*p*2.07+vec2(4.7,8.2);w*=.47;}return s;}
mat2 rot(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
// A coil is restrained only where the next turn has actually passed over it.
// Finishing its own circumference does not contain its exposed outer edge.
float wrapped(float path,float turns,float fill){
 float cover=path+1./turns;
 return (1.-step(1.,cover))*smoothstep(pow(cover,2.6)-.003,pow(cover,2.6)+.003,fill);
}
vec4 filamentFlame(vec2 p,float time,float fill,float lap){
 p=rot(lap*.24)*p;
 vec2 q=p-vec2(-.08,.06),base=q;
 float radius=length(base),angle=atan(base.y,base.x);
 float head=pow(fill,1./2.6),coilCount=5.;
 float localPath=pow(clamp(radius/.76,0.,1.),1./1.6);
 float settled=wrapped(localPath,coilCount,fill);
 float freedom=mix(1.,.1,settled);
 float distortion=fbm(q*3.8+vec2(-time*.16,time*.11));
 vec2 warp=vec2(fbm(q*5.+vec2(time*.13,4.)),fbm(q*5.+vec2(8.,-time*.14)))-.5;
 q+=warp*(.045+.28*u_bloom)*freedom;
 float r=length(q),a=atan(q.y,q.x);
 float glow=0.,sheets=0.,wisps=0.;
 for(int pass=0;pass<4;pass++){
  float f=float(pass);
  float turbulence=fbm(rot(f*.8)*q*(4.+f*3.)+vec2(time*(.12+f*.04),f*13.));
  float winding=a+log(r+.028)*(4.8+f*.24)+turbulence*(.18+freedom*1.1)-time*.12;
  float ridge=abs(sin(winding));
  float filament=pow(.045/(ridge+.045),1.12);
  float sheet=pow(max(0.,1.-ridge),3.)*(.32+turbulence*.8);
  float curl=pow(.008/(abs(sin(winding*1.8+f*1.3))+.008),1.4);
  glow+=filament*(.48+f*.12);sheets+=sheet*.42;wisps+=curl*freedom*.19;
 }
 // Reveal by angular position along one tightly wound path, never a disk.
 float theta=mod(angle+1.5707963+TAU,TAU),coverage=0.;
 for(int turn=0;turn<5;turn++){
  float u=(theta+TAU*float(turn))/(TAU*coilCount);
  float progress=pow(u,2.6);
  float contained=wrapped(u,coilCount,fill);
  float guide=.76*pow(u,1.6);
  float localPitch=.76*1.6*pow(max(u,.01),.6)/coilCount;
  float width=localPitch*mix(.68,.54,contained)+.007;
  float freedom=1.-contained;
  float lickNoise=fbm(vec2(cos(angle)*3.+u*19.-time*.22,sin(angle)*3.+time*.26));
  float reach=pow(smoothstep(.24,.76,lickNoise),2.)*pow(u,1.4)*(.12+.19*u_bloom)*freedom;
  float ripple=(distortion-.5)*.10*freedom*u;
  float distance=radius-guide-ripple;
  float body=1.-smoothstep(width*.64,width,abs(distance));
  float tongue=(1.-smoothstep(width*.25,width*.7,abs(distance-reach*.56)))*smoothstep(.28,.65,lickNoise);
  body=max(body,tongue*freedom);
  float reached=1.-smoothstep(fill-.002,fill+.002,progress);
  coverage=max(coverage,body*reached);
 }
 float endAngle=head*TAU*coilCount-1.5707963;
 vec2 endPoint=vec2(cos(endAngle),sin(endAngle))*(.76*pow(head,1.6));
 vec2 tangent=vec2(-sin(endAngle),cos(endAngle)),normal=vec2(cos(endAngle),sin(endAngle));
 vec2 delta=base-endPoint;
 // A soft rounded burning front bridges the polar branch cut at each turn.
 float frontWidth=.76*1.6*pow(max(head,.01),.6)/coilCount*.54+.007;
 coverage=max(coverage,1.-smoothstep(frontWidth*.6,frontWidth,length(delta)));
 float along=dot(delta,tangent),side=dot(delta,normal);
 float curl=sin(along*13.-time*.9)*along*.65+(distortion-.5)*(.04+head*.17);
 float breadth=(.025+head*.15)*(1.-smoothstep(.02,.38,along));
 float plume=(1.-smoothstep(breadth*.15,breadth,abs(side-curl)))*smoothstep(-.03,.01,along)*(1.-smoothstep(.12,.40,along));
 plume*=smoothstep(.16,.55,fbm(delta*18.+vec2(-time*.5,time*.8)));
 float hotCenter=exp(-radius*32.)*smoothstep(0.,.018,fill);
 float activeFront=plume;
 float flame=glow+sheets*1.4+hotCenter+wisps*(1.+activeFront)*2.+coverage*.15;
 float shaped=max(coverage,plume*.85);
 float alpha=(1.-exp(-flame*2.))*shaped;
 alpha=max(alpha,hotCenter*.92);
 alpha*=smoothstep(0.,.006,fill)*(1.-smoothstep(.93,1.,length(p)));
 float heat=clamp(glow*.65+hotCenter+radius*.5,0.,1.);
 vec3 color=mix(vec3(.76,.055,.006),vec3(1.,.44,.035),clamp(flame,0.,1.));
 color=mix(color,vec3(1.,.84,.24),smoothstep(.22,.75,heat));
 color=mix(color,vec3(1.,.98,.84),smoothstep(.65,1.,heat));
 color=mix(color,mix(vec3(.12,.35,1.),vec3(.77,.95,1.),heat),clamp(lap*.75,0.,1.));
 float grain=noise(gl_FragCoord.xy*.6);color*=.95+.05*grain;
 return vec4(color*alpha,alpha);
}
// The ribbon and its particle emitter share the same live radial profile.
vec4 ribbonFront(float angle,float path,float turns,float fill,float time,float flow){
  float settled=wrapped(path,turns,fill);
  float freedom=mix(1.,.18,settled);
  // Reserve room for large eruptions without cropping them at the canvas edge.
  float r=.64*pow(path,1.6);
  r+=u_bloom*(sin(angle*3.+path*9.+u_seed)*.035+sin(angle*5.-path*7.)*.02)*(.3+path*.7)*freedom;
  float flutter=sin(angle*7.+time*2.1+path*12.)*(.009+.014*u_bloom);
  float twist=((flow-.5)*(.06+u_variant*.018+.10*u_bloom)+flutter)*(.1+.9*path)*freedom;
  float edgeNoise=fbm(vec2(cos(angle)*2.3+path*21.-time*.24,sin(angle)*2.3+path*11.+time*.2));
  float tongue=pow(smoothstep(.25,.68,edgeNoise),2.);
  // Both ends of the variation range grow with outward turn position.
  float growth=pow(clamp(path,0.,1.),1.25);
  float minWidth=mix(.008,.050,growth),maxWidth=mix(.016,.115,growth);
  float width=mix(minWidth,maxWidth,clamp(edgeNoise,0.,1.))*(u_variant<.5?1.:u_variant<1.5?.95:.8);
  width*=mix(1.,.7,settled);
  float localPitch=.64*1.6*pow(max(path,.01),.6)/turns;
  width=max(width,localPitch*.49*settled*(1.-smoothstep(.45,.85,path)));
  width*=1.+u_bloom*.6*growth*tongue*freedom;
  float billow=smoothstep(.20,.70,edgeNoise);
  float flick=pow(.5+.5*sin(angle*17.+path*31.+flow*8.-time*1.8),3.);
  float leading=1.-smoothstep(0.,1.,(pow(fill,1./2.6)-path)*turns);
  float tip=(.035+.25*billow+.18*flick)*growth*freedom*(.5+.5*leading)*(.7+.3*u_bloom);
  return vec4(r+twist,width,tip,edgeNoise);
}
vec4 flame(vec2 p,float time,float fill,float lap){
 p=rot(lap*.43)*p;
 float rad=length(p),angle=mod(atan(p.y,p.x)+1.5707963+TAU,TAU);
 float turns=u_variant<.5?5.25:u_variant<1.5?5.:5.8;
 float flow=fbm(rot(.12*sin(time*.21))*p*4.8+vec2(-time*.26,time*.16));
 float detail=fbm(p*27.+vec2(time*.7,-time*.5));
 float mass=0.,heat=0.,under=0.,inkMass=0.;
 float strokeWidth=.014+.046*clamp(u_fill/3.,0.,1.);
 for(int i=0;i<6;i++){
  float path=(angle+TAU*float(i))/(TAU*turns);
  float progress=pow(path,2.6);
  vec4 profile=ribbonFront(angle,path,turns,fill,time,flow);
  float width=profile.y,tip=profile.z,edgeNoise=profile.w;
  float tongue=pow(smoothstep(.25,.68,edgeNoise),2.);
  float growth=pow(clamp(path,0.,1.),1.25);
  float enabled=(1.-smoothstep(fill-.003,fill+.003,progress))*(1.-step(1.,path));
  float stroke=strokeWidth*(.3+.7*growth);
  float distance=rad-profile.x;
  float outerWidth=width+tip;
  float body=(1.-smoothstep(outerWidth*.35,outerWidth+.012,distance))*(1.-smoothstep(width*.4,width+.012,-distance));
  float lick=1.-smoothstep(width*.25,width*.65,abs(distance-tip*.55));
  lick*=tongue*smoothstep(.15,.7,edgeNoise);
  // Continuous pigment avoids the transverse dark 'scales' of the old bite mask.
  float paint=max(body,lick*.95)*enabled;
  float inkBody=(1.-smoothstep(outerWidth+stroke*.2,outerWidth+stroke,distance))*(1.-smoothstep(width+stroke*.2,width+stroke,-distance));
  float inkLick=(1.-smoothstep(width*.65+stroke*.2,width*.65+stroke,abs(distance-tip*.55)))*tongue;
  inkMass=max(inkMass,max(inkBody,inkLick)*enabled);
  mass+=paint;heat+=paint*(.55+.45*sin(angle*2.-time*1.2+float(i)*1.9))*(.4+.6*detail)+paint*(1.-smoothstep(0.,width,abs(distance)))*.3;
  under+=enabled*(1.-smoothstep(width,width+.032,abs(distance)))*.1;
 }
 // The leading front emits a free particle tail and bright drifting sparks.
 float endPath=pow(fill,1./2.6),endAngle=endPath*TAU*turns-1.5707963;
 vec2 endPoint=vec2(cos(endAngle),sin(endAngle))*(.64*pow(endPath,1.6));
 vec2 tangent=vec2(-sin(endAngle),cos(endAngle));vec2 radial=vec2(cos(endAngle),sin(endAngle));
 // Match the full leading edge, from its inner boundary to the outward billow.
 float frontAngle=mod(endAngle+1.5707963+TAU,TAU);
 float frontFlow=fbm(rot(.12*sin(time*.21))*endPoint*4.8+vec2(-time*.26,time*.16));
 vec4 front=ribbonFront(frontAngle,endPath,turns,fill,time,frontFlow);
 float broadFront=smoothstep(1.,1.65,u_tailEmphasis);
 vec2 emissionPoint=mix(endPoint,radial*front.x,broadFront);
 float edgeInner=mix(-.0225,-front.y,broadFront);
 float edgeOuter=mix(.0225,front.y+front.z,broadFront);
 // A bounded field of fading, shrinking buoyant particles replaces all
 // dedicated tail geometry. Contour the combined plume rather than each puff.
 float ethereal=0.,etherealInk=0.;
 for(int particle=0;particle<20;particle++){
  float id=float(particle)+lap*41.;
  float seed=hash(vec2(id,u_variant+17.));
  float cycle=time*(.32+seed*.18)+seed,age=fract(cycle);
  float birth=hash(vec2(id+floor(cycle)*23.,u_seed+9.));
  float life=1.-age;
  // Stratified births keep every section of the front actively emitting.
  float lane=(float(particle)+.15+.7*birth)/20.;
  vec2 origin=emissionPoint+tangent*(birth-.5)*.055+radial*mix(edgeInner,edgeOuter,mix(seed,lane,broadFront));
  vec2 velocity=tangent*(.03+birth*.08)+vec2((birth-.5)*.16,-.08-seed*.13);
  vec2 pos=origin+velocity*age*mix(1.,1.3,u_tailEmphasis-1.)+vec2(sin(age*5.+birth*31.)*.025*age,-age*age*.13);
  float tailGrowth=pow(endPath,1.25);
  float radius=mix(mix(.006,.030,tailGrowth),mix(.014,.110,tailGrowth),seed)*(.2+.8*life)*sqrt(u_tailEmphasis);
  float density=1.-smoothstep(radius*.15,radius,length(p-pos));
  float weight=(.10+birth*.12)*u_tailEmphasis*life*life*smoothstep(0.,.08,age);
  ethereal+=density*weight;
  etherealInk+=(1.-smoothstep(radius*.15,radius+strokeWidth*(.3+.7*endPath),length(p-pos)))*weight;
 }
 ethereal*=smoothstep(0.,.008,fill);
 etherealInk*=smoothstep(0.,.008,fill);
 // Creamy hot center and asymmetric flame flicker; no prepainted circular rail.
 float core=(1.-smoothstep(.018,.065+flow*.01,rad))*smoothstep(0.,.018,fill);
 float veil=0.;
 if(u_variant>1.5){for(int layer=0;layer<3;layer++){float phase=fract(time*.06+float(layer)/3.);vec2 q=rot(time*.06+float(layer)*1.8)*p*(2.+phase*4.);veil+=fbm(q+vec2(time*.12))*sin(phase*3.14159)*.13;}}
 float pigment=clamp(mass+core,0.,1.);
 float heatDetail=clamp(heat/(mass+.001),0.,1.);
 float hot=clamp(rad/.83*.78+heatDetail*.22,0.,1.);
 vec3 red=vec3(.78,.095,.012),orange=vec3(1.,.36,.025),gold=vec3(1.,.74,.16),cream=vec3(1.,.96,.78);
 vec3 color=mix(red,orange,smoothstep(0.,.3,hot));color=mix(color,gold,smoothstep(.25,.64,hot));color=mix(color,cream,smoothstep(.58,.95,hot));
 float overflowHeat=clamp(lap*.75,0.,1.);
 color=mix(color,mix(vec3(.16,.42,1.),vec3(.76,.94,1.),hot),overflowHeat);

 float grain=noise(gl_FragCoord.xy*.65);color*=.86+.14*grain;
 color=mix(color,gold,veil);float alpha=clamp(pigment*(.7+.3*detail)+under,0.,1.);
 if(fill<=0.)alpha=0.;alpha*=1.-smoothstep(.92,1.,rad);
 // Ink only the top wave's silhouette, not the interior pigment or embers.
 float topLap=max(0.,ceil(u_fill)-1.);
 float interior=step(.32,pigment),outline=step(.32,inkMass)*(1.-interior)*step(topLap-.1,lap);
 color=mix(color,vec3(.018,.012,.018),outline);
 alpha=max(alpha,outline);
 float sparks=0.;
 for(int j=0;j<14;j++){
  float seed=hash(vec2(float(j)+lap*19.,u_variant+2.));
  float age=fract(time*(.30+seed*.4)+seed),travel=age*(.10+seed*.14)*sqrt(u_tailEmphasis);
  float lane=(float(j)+.5)/14.;
  float edge=mix(sin(seed*31.+age*4.)*.045,mix(edgeInner,edgeOuter,lane),broadFront);
  vec2 sp=emissionPoint+tangent*(.03+travel)+radial*(edge+age*.04);sp.y-=age*age*.11;
  float radius=(.006+seed*.005)*(1.-age*.65)*u_tailEmphasis;
  sparks+=(1.-smoothstep(radius*.35,radius,length(p-sp)))*sin(age*3.14159);
 }
 sparks*=smoothstep(0.,.012,fill);color=mix(color,mix(cream,vec3(.7,.92,1.),overflowHeat),clamp(sparks,0.,1.));alpha=max(alpha,clamp(sparks,0.,1.));
 alpha*=1.-smoothstep(.94,1.,rad);
 vec3 particleColor=mix(vec3(1.,.56,.12),vec3(.58,.82,1.),overflowHeat);
 float plumeAlpha=1.-exp(-ethereal*1.8);
 vec3 premult=color*alpha;
 // Soft additive paint glow: leaves the smoke/background showing through.
 premult=min(vec3(1.),premult+particleColor*plumeAlpha);
 alpha=max(alpha,plumeAlpha);
 // The live plume tip shares the strong, Momentum-scaled ink contour.
 float tailOutline=step(.08,etherealInk)*(1.-step(.08,ethereal))*(1.-step(.32,pigment))*step(topLap-.1,lap);
 premult=mix(premult,vec3(.008,.006,.01),tailOutline);
 alpha=max(alpha,tailOutline);
 return vec4(premult,alpha);
}
void main(){
 vec2 p=(gl_FragCoord.xy/u_resolution-.5)*2.;p.y=-p.y;
 // Curling smoky billows sit behind the flame, not across its bright core.
 float extent=.08+.75*sqrt(min(1.,u_fill)),smokeMass=0.;
 vec2 smokePoint=p;
 float smokeTime=u_time*u_energy;
 for(int puff=0;puff<9;puff++){
  float id=float(puff),seed=hash(vec2(id,u_seed+22.)),phase=smokeTime*.15+seed*TAU;
  float a=id*2.39996+sin(phase)*.20;
  vec2 center=vec2(cos(a),sin(a))*extent*(.65+seed*.3);
  center.y-=.035*sin(phase);
  float billowGrowth=pow(clamp((length(center)-.04)/.75,0.,1.),1.25);
  float radius=mix(.035,.14,billowGrowth)+seed*mix(.025,.12,billowGrowth);
  float curl=fbm(rot(phase*.25)*(p-center)*9.+vec2(smokeTime*.12,-smokeTime*.1));
  smokeMass+=max(0.,1.-length((p-center)/(radius*(.65+curl))))*(.38+curl*.4);
 }
 float smokeAlpha=clamp(smokeMass,0.,.82)*smoothstep(0.,.07,u_fill)*u_smoke;
 smokeAlpha*=1.-smoothstep(.91,1.,length(p));
 float smokeRim=fbm(p*9.+vec2(smokeTime*.12,-smokeTime*.08));
 float rim=1.-smoothstep(.12,.5,smokeMass);
 vec3 smokeColor=mix(vec3(.055,.028,.055),vec3(.46,.12,.065),clamp(rim*.75+smokeRim*.45,0.,1.));
 vec4 combined=vec4(smokeColor*smokeAlpha,smokeAlpha);float first=max(0.,ceil(u_fill)-3.);
 for(int layer=0;layer<3;layer++){
  float lap=first+float(layer),amount=clamp(u_fill-lap,0.,1.);
  if(amount>0.){vec4 wave=u_variant>2.5?filamentFlame(p,u_time*u_energy+lap*2.3,amount,lap):flame(p,u_time*u_energy+lap*2.3,amount,lap);combined=wave+combined*(1.-wave.a);}
 }
 gl_FragColor=combined;
}`;
export function WebMomentumFlame({variant,value,capacity,size,numbers,animated,energy,bloom=true,seed=1,smoke=true,tailEmphasis=1,fallback}:{variant:number;value:number;capacity:number;size:number;numbers:boolean;animated:boolean;energy:number;bloom?:boolean;seed?:number;smoke?:boolean;tailEmphasis?:number;fallback?:ReactNode}){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({value,capacity,animated,energy,bloom,seed,smoke,tailEmphasis}),redraw=useRef<()=>void>(()=>{});
 const [error,setError]=useState(''),[contextVersion,setContextVersion]=useState(0);latest.current={value,capacity,animated,energy,bloom,seed,smoke,tailEmphasis};
 useEffect(()=>{
  const el=canvas.current;if(!el)return;const gl=el.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});if(!gl){setError('WebGL unavailable; compare the static studies below.');return;}
  const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s)??'Shader compile failed';gl.deleteShader(s);throw new Error(message);}return s;};
  let program:WebGLProgram,vs:WebGLShader,fs:WebGLShader;
  try{vs=shader(gl.VERTEX_SHADER,vertex);fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??'Shader linking failed');}catch(e){setError(String(e));return;}
  setError('');
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);gl.useProgram(program);const attribute=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  const loc=(name:string)=>gl.getUniformLocation(program,name),resolution=loc('u_resolution'),time=loc('u_time'),fill=loc('u_fill'),style=loc('u_variant'),power=loc('u_energy'),expansion=loc('u_bloom'),randomSeed=loc('u_seed'),smoky=loc('u_smoke'),tail=loc('u_tailEmphasis');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,previous=performance.now(),lastPaint=0,clock=0,visible=true,dead=false;
  const targetFill=()=>Math.max(0,latest.current.value/latest.current.capacity);
  // Presentation follows the live reserve along the spiral path. Retarget from
  // the current front so rapid receipts never restart or jump the growing flame.
  let displayedFill=targetFill(),lastTarget=displayedFill;
  const draw=()=>{if(dead||gl.isContextLost())return;const state=latest.current,target=targetFill();
   // Reduced motion and explicit edits to a static study render immediately.
   // A paused in-flight transition otherwise holds its exact current front.
   if(reduced.matches || !state.animated && target!==lastTarget)displayedFill=target;
   lastTarget=target;
   const width=Math.min(480,Math.max(128,Math.round(el.clientWidth*Math.min(devicePixelRatio,1.5))));if(el.width!==width){el.width=el.height=width;}gl.viewport(0,0,width,width);gl.useProgram(program);gl.uniform2f(resolution,width,width);gl.uniform1f(time,clock);gl.uniform1f(fill,displayedFill);gl.uniform1f(style,variant);gl.uniform1f(power,1);gl.uniform1f(expansion,state.bloom?1:0);gl.uniform1f(randomSeed,state.seed);gl.uniform1f(smoky,state.smoke?1:0);gl.uniform1f(tail,state.tailEmphasis);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);};
  const tick=(now:number)=>{const dt=Math.min(.1,(now-previous)/1000);previous=now;
   if(visible&&!document.hidden&&latest.current.animated&&!reduced.matches){
    const target=targetFill(),step=dt*Math.max(0,latest.current.energy);
    const transitioning=Math.abs(target-displayedFill)>0.00001;
    if(transitioning){
     displayedFill+=(target-displayedFill)*(1-Math.exp(-step/(target>displayedFill ? .18 : .12)));
     if(Math.abs(target-displayedFill)<=0.00001)displayedFill=target;
    }
    if(target>0 || displayedFill>0 || transitioning){clock+=step;if(now-lastPaint>=33){draw();lastPaint=now;}}
   }
   frame=requestAnimationFrame(tick);
  };
  redraw.current=draw;draw();frame=requestAnimationFrame(tick);const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)draw();});observer.observe(el);const resize=new ResizeObserver(draw);resize.observe(el);const lost=(event:Event)=>{event.preventDefault();setError('Graphics context lost; waiting for restoration.');};el.addEventListener('webglcontextlost',lost);
  // Restoration discards GPU resources; rebuild and release the static fallback.
  const restored=()=>setContextVersion(version=>version+1);el.addEventListener('webglcontextrestored',restored);
  return()=>{dead=true;redraw.current=()=>{};cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();el.removeEventListener('webglcontextlost',lost);el.removeEventListener('webglcontextrestored',restored);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
   // Strict Mode remounts effects on the same connected canvas. Release its
   // context only after a real removal, so repeated radial opens stay bounded.
   queueMicrotask(()=>{if(!el.isConnected)gl.getExtension('WEBGL_lose_context')?.loseContext();});
  };
 },[variant,contextVersion]);
 useEffect(()=>redraw.current(),[value,capacity,animated,energy,bloom,seed,smoke,tailEmphasis]);
 return <div className="momentum-study__icon momentum-study__web" style={{width:size,maxWidth:'100%'}}><canvas ref={canvas} hidden={Boolean(error && fallback)} width={360} height={360} data-web-flame={variant} role="img" aria-label={`${FLAME_STUDIES[variant].name}, live procedural flame, ${Math.floor(value)} Momentum`}/>{numbers&&<strong>{Math.floor(value)}</strong>}{error&&(fallback ?? <span role="alert">{error}</span>)}</div>;
}

