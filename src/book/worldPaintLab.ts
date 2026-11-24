import * as THREE from 'three';
import {createMeadowTerrain,createMeadowNavigation,createMeadowSurface} from './castleMeadowNavigation';

/**
 * Paint Lab: a small glade that starts as a pencil drawing and is painted in
 * watercolour where Hero walks. One blossom tree, three flower beds, a path and
 * a ring of bushes. When Hero reaches the tree, one last wash floods the page.
 *
 * Method adapted from blendi/watercolour (https://patch.gg/blendi/watercolour,
 * MIT, Copyright 2026 Patch), rebuilt to the budget in
 * docs/research/watercolour-60fps-feasibility.md: ~30k culled-cheap brush dabs
 * instead of 650k, no shadow map, no MSAA target and no full-frame pass. Paper
 * grain, pencil and the "when the paint arrived" map live in the materials.
 */

const NEVER=-1e9,MAP_CELLS=128,MAP_SIZE=48,MAP_X0=-24,MAP_Z0=-24;
const REACH=5,SPREAD=5.5;
export const PAINT_LAB={
 tree:{x:0,z:-4},
 door:{x:0,z:12.5,yaw:Math.PI},
 start:{x:0,z:4.5,heading:Math.PI},
 beds:[{x:-5,z:3,kind:'poppy'},{x:5.5,z:1.5,kind:'cornflower'},{x:-4,z:-8.5,kind:'daisy'}] as const,
} as const;
const SUN=new THREE.Vector3(.55,.72,.42).normalize();

export function paintLabHeight(x:number,z:number){
 const r=Math.hypot(x,z),bank=Math.max(0,Math.min(1,(r-14.5)/6));
 return 3.8*bank*bank*(3-2*bank)+.22*Math.sin(x*.31+1)*Math.cos(z*.27)+.12*Math.sin(x*.9+z*.6);
}
const pathX=(z:number)=>1.5*Math.sin(z*.33+.4);
const PATH_W=.95;
const onPath=(x:number,z:number)=>z>PAINT_LAB.tree.z+1&&z<14&&Math.abs(x-pathX(z))<PATH_W;

function seeded(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

const COMMON=/* glsl */`
uniform sampler2D uMap; uniform vec4 uRect; uniform float uNow; uniform float uTime; uniform vec3 uSun; uniform float uPx;
float lhash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(lhash(i),lhash(i+vec2(1,0)),f.x),mix(lhash(i+vec2(0,1)),lhash(i+vec2(1,1)),f.x),f.y);}
// Unpainted cells read as "arrives ten seconds from now", so the edge between painted and dry interpolates smoothly
// inside a cell instead of stepping along the map's grid.
float paintCell(ivec2 i){if(any(lessThan(i,ivec2(0)))||any(greaterThanEqual(i,ivec2(${MAP_CELLS}))))return uNow+10.;float t=texelFetch(uMap,i,0).r;return t<-1e8?uNow+10.:t;}
float arrived(vec2 xz){vec2 g=(xz-uRect.xy)*uRect.zw*${MAP_CELLS}.-.5;ivec2 i=ivec2(floor(g));vec2 f=fract(g);
 return mix(mix(paintCell(i),paintCell(i+ivec2(1,0)),f.x),mix(paintCell(i+ivec2(0,1)),paintCell(i+ivec2(1,1)),f.x),f.y);}
// Seconds since paint reached this point, travelling from its root at root.w seconds a metre.
float paintAge(vec3 at,vec4 root){return uNow-arrived(root.xz)-distance(at,root.xyz)*root.w;}
`;
const PAPER=/* glsl */`
uniform vec3 uGlaze;
float grain(){vec2 px=gl_FragCoord.xy;return vnoise(px*.5)*.55+vnoise(px*1.2+9.)*.45;}
vec3 paperTone(float g){return vec3(.98,.962,.925)*(.955+.06*g)*(1.-.03*vnoise(gl_FragCoord.xy*.006+3.));}
float hatch(float amount){float l=abs(fract((gl_FragCoord.x+gl_FragCoord.y)/uPx)-.5)*2.;return (1.-smoothstep(.14,.32,l))*amount;}
const vec3 PENCIL=vec3(.40,.38,.44);
// A wash: what the pigment leaves of the paper's white. Deeper while wet and at its creeping edge, uneven in clouds,
// settled into the grain, with a violet glaze in shade.
vec3 paintWash(vec3 pig,float shade,float age,float pool,vec2 xz,float g){
 float wet=1.-smoothstep(0.,3.,age),edge=1.-smoothstep(0.,.55,age);
 float cloud=vnoise(xz*.45)*.6+vnoise(xz*1.7+7.)*.4;
 float density=pool*(.7+.3*cloud+.3*(g-.5)*(1.+wet))*(1.+.22*wet+.5*edge);
 vec3 col=pow(max(pig,vec3(.012)),vec3(density));
 col*=mix(vec3(1.),uGlaze,shade*.6);
 col=mix(col,vec3(1.),smoothstep(.72,.95,1.-g)*.18*(1.-wet));
 return col*paperTone(g);
}
vec4 toOutput(vec3 srgb){return linearToOutputTexel(vec4(pow(clamp(srgb,0.,1.),vec3(2.2)),1.));}
`;

type Shared={uMap:{value:THREE.DataTexture};uRect:{value:THREE.Vector4};uNow:{value:number};uTime:{value:number};uSun:{value:THREE.Vector3};uPx:{value:number};uGlaze:{value:THREE.Color}};

function groundMaterial(shared:Shared){
 return new THREE.ShaderMaterial({
  clipping:true,
  uniforms:{...shared,uShadow:{value:new THREE.Vector4(PAINT_LAB.tree.x-1.6,PAINT_LAB.tree.z-1.1,4.2,3.2)},uPathTree:{value:PAINT_LAB.tree.z+1}},
  vertexShader:/* glsl */`
   attribute vec3 pigment; varying vec3 vPig; varying vec3 vWorld; varying vec3 vNormal;
   #include <clipping_planes_pars_vertex>
   void main(){vPig=pigment;vWorld=(modelMatrix*vec4(position,1.)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);
    vec4 mvPosition=viewMatrix*vec4(vWorld,1.);gl_Position=projectionMatrix*mvPosition;
    #include <clipping_planes_vertex>
   }`,
  fragmentShader:/* glsl */`
   ${COMMON}${PAPER}
   uniform vec4 uShadow; uniform float uPathTree;
   varying vec3 vPig; varying vec3 vWorld; varying vec3 vNormal;
   #include <clipping_planes_pars_fragment>
   void main(){
    #include <clipping_planes_fragment>
    vec2 xz=vWorld.xz; float g=grain();
    // (the wet front comes on raggedly, running ahead here and hanging back there)
    float age=paintAge(vWorld,vec4(vWorld,0.))+(vnoise(xz*.9)-.5)*1.1+(vnoise(xz*3.1)-.5)*.35;
    float shade=1.-smoothstep(.15,.8,dot(normalize(vNormal),uSun));
    // the crown's shade, laid in as the one who sketched it knew it would fall
    float crown=1.-smoothstep(.62,1.,length((xz-uShadow.xy)/uShadow.zw)+(vnoise(xz*1.3)-.5)*.4);
    shade=max(shade,crown*.85);
    float px=${PATH_W.toFixed(2)}, d=abs(xz.x-1.5*sin(xz.y*.33+.4));
    float pathEdge=step(uPathTree,xz.y)*step(xz.y,14.)*(1.-smoothstep(.0,.045,abs(d-px)))*(.45+.55*vnoise(xz*4.));
    // grass is gone over in short strokes lying away from the eye
    vec3 pig=vPig;
    float grassy=smoothstep(0.,.05,pig.g-max(pig.r,pig.b));
    if(grassy>0.){vec2 cell=floor(xz*5.);vec2 q=fract(xz*5.)-.5;float h=lhash(cell);
     float stroke=1.-smoothstep(.04,.09,abs(q.x+.25*(h-.5)+q.y*.3));stroke*=step(abs(q.y),.32);
     pig=mix(pig,pig*(h>.5?vec3(1.3,1.2,.75):vec3(.6,.72,.68)),stroke*grassy*.55);}
    vec3 wash=paintWash(pig,shade,age,1.,xz,g)*mix(vec3(1.),PENCIL,pathEdge*.18);
    vec3 drawn=paperTone(g)*mix(vec3(1.),PENCIL,clamp(hatch(smoothstep(.4,.75,shade))*.55+pathEdge*.7,0.,1.));
    gl_FragColor=toOutput(mix(drawn,wash,smoothstep(0.,.8,age)));
   }`,
 });
}

function solidMaterial(shared:Shared){
 return new THREE.ShaderMaterial({
  clipping:true,uniforms:{...shared},
  vertexShader:/* glsl */`
   attribute vec3 pigment; attribute vec4 root; varying vec3 vPig; varying vec4 vRoot; varying vec3 vWorld; varying vec3 vNormal;
   #include <clipping_planes_pars_vertex>
   void main(){vPig=pigment;vRoot=root;vWorld=(modelMatrix*vec4(position,1.)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);
    vec4 mvPosition=viewMatrix*vec4(vWorld,1.);gl_Position=projectionMatrix*mvPosition;
    #include <clipping_planes_vertex>
   }`,
  fragmentShader:/* glsl */`
   ${COMMON}${PAPER}
   varying vec3 vPig; varying vec4 vRoot; varying vec3 vWorld; varying vec3 vNormal;
   #include <clipping_planes_pars_fragment>
   void main(){
    #include <clipping_planes_fragment>
    float g=grain(); vec3 n=normalize(vNormal), v=normalize(cameraPosition-vWorld);
    float age=paintAge(vWorld,vRoot)+(vnoise(vWorld.xy*2.+vWorld.z)-.5)*.6;
    float shade=1.-smoothstep(.05,.75,dot(n,uSun));
    float rim=smoothstep(.72,.9,1.-abs(dot(n,v)));
    vec3 wash=paintWash(vPig,shade,age,1.05,vWorld.xy*1.7+vWorld.z,g)*mix(vec3(1.),PENCIL,rim*.3);
    vec3 drawn=paperTone(g)*mix(vec3(1.),PENCIL,clamp(rim*.85+hatch(smoothstep(.35,.7,shade))*.5,0.,1.));
    gl_FragColor=toOutput(mix(drawn,wash,smoothstep(0.,.8,age)));
   }`,
 });
}

// Kinds: 0 a touch of leaves, 1 a tuft of grass, 2 a flower (dabB.w petals), 3 a soft ragged mass.
function dabMaterial(shared:Shared){
 return new THREE.ShaderMaterial({
  clipping:true,uniforms:{...shared},
  vertexShader:/* glsl */`
   attribute vec3 offset; attribute vec2 dabS; attribute vec4 dabB; attribute vec3 dabColor; attribute vec3 dabNormal; attribute vec4 root;
   ${COMMON}
   varying vec2 vCorner; varying vec4 vDabB; varying vec3 vColor; varying float vAge; varying float vShade; varying vec3 vWorld;
   #include <clipping_planes_pars_vertex>
   void main(){
    vCorner=position.xy; vDabB=dabB; vColor=dabColor; vWorld=offset;
    float kind=dabB.z, seed=fract(dabB.y);
    vAge=paintAge(offset,root);
    float live=smoothstep(0.,2.5,vAge);
    vShade=1.-smoothstep(-.35,.75,dot(normalize(dabNormal),uSun));
    vec4 mvPosition=viewMatrix*vec4(offset,1.);
    // (a touch right against the lens would fill the page: it isn't drawn)
    vec2 c=position.xy*smoothstep(.5,1.4,-mvPosition.z);
    if(kind>.5&&kind<1.5){
     // a tuft standing on its foot, leaning, swaying once painted
     vec3 upV=normalize(mix(normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz),vec3(0.,1.,0.),.5));
     vec3 rightV=normalize(cross(upV,vec3(0.,0.,1.)));
     float t=(c.y+1.)*.5, lean=dabB.x+live*.3*sin(uTime*1.7+offset.x*.5+offset.z*.4+seed*6.);
     mvPosition.xyz+=rightV*(c.x*dabS.x+lean*t*t*dabS.y*2.)+upV*(t*2.*dabS.y);
    }else{
     float a=dabB.x+live*.18*sin(uTime*1.3+seed*40.);
     vec2 o=c*dabS;
     mvPosition.xy+=vec2(cos(a)*o.x-sin(a)*o.y,sin(a)*o.x+cos(a)*o.y);
     mvPosition.x+=live*.05*sin(uTime*.9+offset.x*.35+offset.y*.3);
    }
    gl_Position=projectionMatrix*mvPosition;
    #include <clipping_planes_vertex>
   }`,
  fragmentShader:/* glsl */`
   ${COMMON}${PAPER}
   varying vec2 vCorner; varying vec4 vDabB; varying vec3 vColor; varying float vAge; varying float vShade; varying vec3 vWorld;
   #include <clipping_planes_pars_fragment>
   vec3 h3(float i,float s){return fract(sin(vec3(i*12.9898+s*91.7,i*78.233+s*47.3,i*37.719+s*13.1))*43758.5453);}
   void main(){
    #include <clipping_planes_fragment>
    vec2 p=vCorner; float seed=fract(vDabB.y), k=vDabB.z; bool line=vDabB.y>=1.;
    float R=2., tone=0., delay=0., u=0., eye=0.;
    if(k<.5){
     for(int i=0;i<4;i++){vec3 h=h3(float(i),seed);vec2 q=p-(h.xy-.5)*1.;float a=(h.z-.5)*1.7,ca=cos(a),sa=sin(a);
      q=vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y);float s=.3+.16*h.x,y=q.y/s;
      float r=abs(y)<1.?abs(q.x+.1*s*sin(y*2.5+h.y*9.))/(s*.44*pow(1.-y*y,.7)+.004):2.;
      if(r<R){R=r;tone=h.z*2.-1.;delay=h.y;}}
    }else if(k<1.5){
     float t=(p.y+1.)*.5;
     for(int i=0;i<3;i++){vec3 h=h3(float(i),seed);float len=.45+.55*h.y,uu=t/len,x0=(h.x-.5)*.6,bend=(h.z-.5)*len;
      float hw=.09*(1.-uu)*(.45+.55*smoothstep(0.,.12,uu))+.014;float r=uu<1.?abs(p.x-x0-bend*uu*uu)/hw:2.;
      if(r<R){R=r;tone=h.x*2.-1.;u=min(uu,1.);delay=h.y*.5;}}
    }else if(k<2.5){
     float N=vDabB.w,rad=length(p),ang=atan(p.y,p.x),turn=ang/6.2832*N+seed,kk=abs(fract(turn)-.5)*2.;
     float L=N>9.5?.78+.18*fract(sin(floor(turn)*91.3+seed*7.)*437.5):.7+.27*sqrt(1.-kk*kk);
     float wide=N>9.5?.62*sin(3.1416*clamp(rad/L,0.,1.))+.1:2.;
     R=max(rad/L,kk/wide);tone=kk*2.-1.;eye=step(rad,N>9.5?.27:.2);if(eye>.5)R=rad;
    }else{
     float ang=atan(p.y,p.x);R=length(p)*(1.+.13*sin(ang*3.+seed*40.)+.07*sin(ang*5.+seed*91.))+.12*(vnoise(p*1.6+seed*17.)-.5);
    }
    float fw=fwidth(R);
    if(R>1.)discard;
    // before the paint only the pencilled touches are there, as outlines; then each mark comes in from its middle out
    float mine=vAge-delay*.7;
    bool body=mine>0.&&R<mix(.3,1.001,smoothstep(0.,.5,mine));
    bool loop=line&&(k>.5&&k<1.5?true:R>1.-1.8*fw);
    if(!body&&!loop)discard;
    float g=grain(),shade=vShade,pool=1.;vec3 pig=vColor;
    if(k<.5){pig=mix(pig,pig*vec3(.62,.78,.8),shade);pool=1.+.22*tone+.18*smoothstep(.5,1.,R);}
    else if(k<1.5){pig=mix(pig,pig*vec3(.66,.78,.74),shade);pool=(.62+.35*sin(3.1416*min(u*1.2,1.)))*(1.+.2*tone);}
    else if(k<2.5){float N=vDabB.w;pig=mix(pig,N>9.5?vec3(.9,.62,.08):N>6.5?vec3(.06,.05,.22):vec3(.05,.03,.06),eye);
     pool=1.25+.3*smoothstep(.4,1.,R)+.22*tone;shade*=.5;}
    else{pig=mix(pig,pig*vec3(.66,.8,.82),shade);pool=.85+.2*smoothstep(.5,1.,R);}
    vec3 col=body?paintWash(pig,shade*(k>1.5&&k<2.5?.4:1.),mine,pool,vWorld.xy*3.+vWorld.z,g):paperTone(g);
    if(loop)col*=body?vec3(.95,.94,.96):mix(vec3(1.),PENCIL,.55+.3*vnoise(p*3.+seed*9.));
    gl_FragColor=toOutput(col);
   }`,
 });
}

function skyMaterial(shared:Shared,skyAt:{value:number}){
 return new THREE.ShaderMaterial({
  clipping:true,side:THREE.BackSide,depthWrite:false,uniforms:{...shared,uSkyAt:skyAt},
  vertexShader:/* glsl */`
   varying vec3 vDir;
   #include <clipping_planes_pars_vertex>
   void main(){vDir=normalize(position);vec4 mvPosition=viewMatrix*vec4((modelMatrix*vec4(position,1.)).xyz,1.);gl_Position=projectionMatrix*mvPosition;
    #include <clipping_planes_vertex>
   }`,
  fragmentShader:/* glsl */`
   ${COMMON}${PAPER}
   uniform float uSkyAt; varying vec3 vDir;
   #include <clipping_planes_pars_fragment>
   void main(){
    #include <clipping_planes_fragment>
    vec3 dir=normalize(vDir);float g=grain(),up=clamp(dir.y,0.,1.),ang=atan(dir.z,dir.x);
    float age=uNow-uSkyAt-up*2.5+(vnoise(vec2(ang*3.,up*4.))-.5)*1.2;
    // a pale blue wash, deepest overhead, warmed toward the sun, broken by a few soft clouds left as paper
    vec3 pig=mix(vec3(.93,.86,.7),vec3(.55,.72,.86),smoothstep(.02,.5,up));
    pig=mix(pig,vec3(.98,.86,.62),pow(max(dot(dir,uSun),0.),4.)*.5);
    float cloud=smoothstep(.55,.75,vnoise(vec2(ang*2.2,up*6.))*.7+vnoise(vec2(ang*7.,up*14.))*.3)*smoothstep(.05,.25,up);
    vec3 wash=mix(paintWash(pig,0.,age,.8,vec2(ang*6.,up*9.),g),paperTone(g),cloud*.85);
    float far=smoothstep(.0,.02,up);
    // the far hills: two ranges, each one wash deepest at its crest, thinning into mist
    float ridgeA=.055+.03*vnoise(vec2(ang*4.,1.))+.015*vnoise(vec2(ang*13.,2.)),ridgeB=.03+.02*vnoise(vec2(ang*6.,5.))+.01*vnoise(vec2(ang*19.,7.));
    vec3 hillA=paintWash(vec3(.62,.66,.78),0.,age+1.,1.+.8*smoothstep(ridgeA-.02,ridgeA,up),vec2(ang*5.,up*20.),g);
    vec3 hillB=paintWash(vec3(.48,.58,.55),0.,age+1.5,1.+.8*smoothstep(ridgeB-.015,ridgeB,up),vec2(ang*7.,up*30.),g);
    wash=mix(wash,hillA,step(up,ridgeA)*smoothstep(-.02,ridgeA,up));
    wash=mix(wash,hillB,step(up,ridgeB));
    float P=smoothstep(0.,1.,age);
    vec3 drawn=paperTone(g)*mix(vec3(1.),PENCIL,(1.-smoothstep(0.,.0025,abs(up-ridgeA)))*.5+(1.-smoothstep(0.,.0025,abs(up-ridgeB)))*.4);
    gl_FragColor=toOutput(mix(drawn,wash,P*far+(1.-far)*P));
   }`,
 });
}

function createDabs(material:THREE.ShaderMaterial){
 const cols={offset:3,dabS:2,dabB:4,dabColor:3,dabNormal:3,root:4} as const;
 const data:Record<keyof typeof cols,number[]>={offset:[],dabS:[],dabB:[],dabColor:[],dabNormal:[],root:[]};
 const colour=new THREE.Color();let n=0;
 return {
  add(x:number,y:number,z:number,o:{w:number;h?:number;turn?:number;seed:number;kind:number;colour:THREE.ColorRepresentation;normal?:THREE.Vector3;root?:[number,number,number,number];line?:boolean;extra?:number}){
   colour.set(o.colour).convertLinearToSRGB();const nrm=o.normal??new THREE.Vector3(0,1,0);
   data.offset.push(x,y,z);data.dabS.push(o.w,o.h??o.w);data.dabB.push(o.turn??0,Math.min(o.seed,.999)+(o.line?2:0),o.kind,o.extra??0);
   data.dabColor.push(colour.r,colour.g,colour.b);data.dabNormal.push(nrm.x,nrm.y,nrm.z);data.root.push(...(o.root??[x,y,z,0]));n++;
  },
  get count(){return n;},
  build(name:string){
   const g=new THREE.InstancedBufferGeometry();
   g.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));g.setIndex([0,1,2,0,2,3]);
   for(const k of Object.keys(cols) as (keyof typeof cols)[])g.setAttribute(k,new THREE.InstancedBufferAttribute(new Float32Array(data[k]),cols[k]));
   g.instanceCount=n;
   const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.frustumCulled=false;
   return mesh;
  },
 };
}

/** Tints colours in sRGB, the space the washes are mixed in. */
const shadeHex=(hex:string,k:number,warm=0)=>{const c=new THREE.Color(hex);return new THREE.Color(Math.min(1,c.r*k+warm),Math.min(1,c.g*k+warm*.6),Math.min(1,c.b*k));};

export function createPaintLabArt(low:boolean,reduced:boolean){
 const data=new Float32Array(MAP_CELLS*MAP_CELLS).fill(NEVER);
 const map=new THREE.DataTexture(data,MAP_CELLS,MAP_CELLS,THREE.RedFormat,THREE.FloatType);
 map.minFilter=map.magFilter=THREE.NearestFilter;map.needsUpdate=true;
 const shared:Shared={uMap:{value:map},uRect:{value:new THREE.Vector4(MAP_X0,MAP_Z0,1/MAP_SIZE,1/MAP_SIZE)},uNow:{value:0},uTime:{value:0},
  uSun:{value:SUN.clone()},uPx:{value:5},uGlaze:{value:new THREE.Color(.74,.72,.9)}};
 const skyAt={value:1e5};
 const rnd=seeded(117);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#f6f1e6');scene.name='Paint Lab';

 // --- ground ---
 const span=46,seg=low?64:92,geometry=new THREE.PlaneGeometry(span,span,seg,seg).rotateX(-Math.PI/2);
 const pos=geometry.attributes.position,pig=new Float32Array(pos.count*3),c=new THREE.Color();
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z);pos.setY(i,paintLabHeight(x,z));
  const path=Math.max(0,1-Math.abs(x-pathX(z))/(PATH_W+.35))*(z>PAINT_LAB.tree.z+.5&&z<14.5?1:0);
  const meadow=c.set('#a9c77a').lerp(new THREE.Color('#cbd48c'),.5+.5*Math.sin(x*.4+z*.23)).lerp(new THREE.Color('#86ad6a'),Math.min(1,Math.max(0,(r-13)/5)));
  const under=Math.max(0,1-Math.hypot(x-PAINT_LAB.tree.x,z-PAINT_LAB.tree.z)/4);
  meadow.lerp(new THREE.Color('#7a9f68'),under*.6).lerp(new THREE.Color('#e2c592'),Math.min(1,path*1.6));
  meadow.convertLinearToSRGB();pig.set([meadow.r,meadow.g,meadow.b],i*3);
 }
 geometry.setAttribute('pigment',new THREE.BufferAttribute(pig,3));geometry.computeVertexNormals();
 const floor=new THREE.Mesh(geometry,groundMaterial(shared));floor.name='Paint Lab ground';scene.add(floor);

 // --- solids: the tree's trunk and boughs, stones ---
 const solidMat=solidMaterial(shared),solidParts:THREE.BufferGeometry[]=[];
 const T=PAINT_LAB.tree,ty=paintLabHeight(T.x,T.z)-.15,treeRoot:[number,number,number,number]=[T.x,ty,T.z,.38];
 const piece=(g:THREE.BufferGeometry,hex:string,root:[number,number,number,number]|null)=>{
  const p=g.attributes.position,col=new Float32Array(p.count*3),rt=new Float32Array(p.count*4),base=new THREE.Color(hex).convertLinearToSRGB();
  for(let i=0;i<p.count;i++){const k=.92+.16*Math.sin(p.getY(i)*3.1+p.getX(i)*5.);col.set([base.r*k,base.g*k,base.b*k],i*3);rt.set(root??[p.getX(i),p.getY(i),p.getZ(i),0],i*4);}
  g.setAttribute('pigment',new THREE.BufferAttribute(col,3));g.setAttribute('root',new THREE.BufferAttribute(rt,4));g.deleteAttribute('uv');solidParts.push(g.index?g.toNonIndexed():g);
 };
 piece(new THREE.CylinderGeometry(.22,.4,4.4,12,4).translate(T.x,ty+2.2,T.z),'#6b5244',treeRoot);
 const crown=new THREE.Vector3(T.x,ty+5.3,T.z);
 const boughs:[THREE.Vector3,THREE.Vector3][]=[];
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+.5,from=new THREE.Vector3(T.x,ty+3.2+i*.25,T.z),to=new THREE.Vector3(T.x+Math.cos(a)*2.1,ty+5+rnd()*.8,T.z+Math.sin(a)*2.1);
  const len=from.distanceTo(to),g=new THREE.CylinderGeometry(.07,.15,len,7).translate(0,len/2,0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()));g.translate(from.x,from.y,from.z);
  piece(g,'#6b5244',treeRoot);boughs.push([from,to]);
 }
 const stoneSpots:[number,number,number][]=[[2.4,6.5,.45],[-2.2,1.2,.35],[2.8,-1.5,.55],[-1.8,9.5,.3],[6.5,-6,.7],[-7,6.5,.6]];
 const solids:THREE.Mesh[]=[],proxy=new THREE.MeshBasicMaterial({visible:false});
 for(const [x,z,s] of stoneSpots){
  const g=new THREE.IcosahedronGeometry(s,1);g.scale(1.3,.62,1);g.translate(x,paintLabHeight(x,z)+s*.25,z);piece(g,'#a49c92',null);
  const m=new THREE.Mesh(new THREE.BoxGeometry(s*2.4,s*1.4,s*2),proxy);m.position.set(x,paintLabHeight(x,z)+s*.5,z);m.name='Paint Lab stone clearance';scene.add(m);solids.push(m);
 }
 const trunkProxy=new THREE.Mesh(new THREE.BoxGeometry(1,4,1),proxy);trunkProxy.position.set(T.x,ty+2,T.z);trunkProxy.name='Paint Lab trunk clearance';scene.add(trunkProxy);solids.push(trunkProxy);
 const merged=new THREE.Mesh(mergeParts(solidParts),solidMat);merged.name='Paint Lab solids';scene.add(merged);

 // --- touches of the brush ---
 const dabMat=dabMaterial(shared),dabs=createDabs(dabMat),grass=createDabs(dabMat);
 const n=new THREE.Vector3();
 const LEAF=['#7fae4e','#5f9446','#9dbb57','#4f7f43'],BLOSSOM=['#f2a6bd','#f7c6d3','#e98aa8'];
 // the crown: clumps of leaves round the boughs' tips, darkest inside, lightest toward the sun; blossom among them
 const clumps:THREE.Vector3[]=boughs.map(([,to])=>to.clone());
 for(let i=0;i<12;i++)clumps.push(crown.clone().add(new THREE.Vector3((rnd()-.5)*4.2,(rnd()-.35)*2.4,(rnd()-.5)*4.2)));
 clumps.push(crown.clone().add(new THREE.Vector3(0,1.4,0)));
 const perClump=low?220:360;
 for(const cc of clumps){
  const rc=.95+rnd()*.5;
  dabs.add(cc.x,cc.y,cc.z,{w:rc*1.15,seed:rnd(),kind:3,colour:shadeHex('#5f8f48',.85),normal:n.copy(cc).sub(crown).normalize().clone(),root:treeRoot,line:rnd()<.5});
  for(let j=0;j<perClump;j++){
   const d=new THREE.Vector3(rnd()*2-1,rnd()*2-1,rnd()*2-1);if(d.lengthSq()>1){j--;continue;}
   const p=cc.clone().addScaledVector(d,rc);
   const out=p.clone().sub(crown).normalize(),sunny=out.dot(SUN);
   const blossom=rnd()<.22;
   const hex=blossom?BLOSSOM[Math.floor(rnd()*3)]:LEAF[Math.floor(rnd()*4)];
   dabs.add(p.x,p.y,p.z,{w:blossom?.15:.3,turn:rnd()*6.28,seed:rnd(),kind:blossom?2:0,extra:blossom?5:0,
    colour:shadeHex(hex,.82+.22*Math.max(0,sunny)+.1*d.length(),.03*Math.max(0,sunny)),normal:out,root:treeRoot,line:rnd()<.12});
  }
 }
 // petals already fallen under the tree
 for(let i=0;i<(low?60:140);i++){const a=rnd()*6.28,r=Math.sqrt(rnd())*3.6,x=T.x+Math.cos(a)*r-.8,z=T.z+Math.sin(a)*r-.5;
  dabs.add(x,paintLabHeight(x,z)+.03,z,{w:.07,seed:rnd(),kind:2,extra:5,colour:BLOSSOM[i%3],root:[x,paintLabHeight(x,z),z,0]});}
 // the beds: each goes off at once when the wash reaches its middle
 const BEDS={poppy:{hex:['#d8402a','#e2552f','#c8361f'],petals:5,w:.13},cornflower:{hex:['#4f6fd0','#5d7fe0','#3e5bb8'],petals:8,w:.11},daisy:{hex:['#fbfaf4','#f3efe6'],petals:12,w:.1}} as const;
 for(const bed of PAINT_LAB.beds){
  const spec=BEDS[bed.kind],by=paintLabHeight(bed.x,bed.z),root:[number,number,number,number]=[bed.x,by,bed.z,0];
  for(let i=0;i<(low?110:220);i++){const a=rnd()*6.28,r=Math.sqrt(rnd())*1.6,x=bed.x+Math.cos(a)*r,z=bed.z+Math.sin(a)*r*.8,y=paintLabHeight(x,z)+.25+rnd()*.25;
   dabs.add(x,y,z,{w:spec.w*(.8+.4*rnd()),turn:rnd()*6.28,seed:rnd(),kind:2,extra:spec.petals,colour:spec.hex[i%spec.hex.length],root,line:rnd()<.35});
   if(i%2===0)grass.add(x,y-.3,z,{w:.08,h:.2,turn:(rnd()-.5)*.4,seed:rnd(),kind:1,colour:'#5e8f45',root});}
 }
 // bushes round the rim, closing the glade in (a gap where the card stands)
 for(let i=0;i<11;i++){
  const a=-Math.PI/2+(i+.5)/11*Math.PI*1.75+Math.PI*.125+Math.PI/2,r=15.2+rnd()*1.2,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(Math.abs(x)<3&&z>8)continue;
  const by=paintLabHeight(x,z),centre=new THREE.Vector3(x,by+1.1,z),root:[number,number,number,number]=[x,by,z,.25];
  dabs.add(centre.x,centre.y,centre.z,{w:1.7,seed:rnd(),kind:3,colour:'#557f47',normal:new THREE.Vector3(-x,4,-z).normalize(),root,line:true});
  for(let j=0;j<(low?120:220);j++){const d=new THREE.Vector3(rnd()*2-1,rnd()*1.4-.4,rnd()*2-1);if(d.lengthSq()>1){j--;continue;}
   const p=centre.clone().add(d.multiplyScalar(1.5)),out=p.clone().sub(centre).normalize();
   dabs.add(p.x,p.y,p.z,{w:.28,turn:rnd()*6.28,seed:rnd(),kind:0,colour:shadeHex(LEAF[Math.floor(rnd()*4)],.8+.2*Math.max(0,out.dot(SUN))),normal:out,root,line:rnd()<.1});}
  const m=new THREE.Mesh(new THREE.BoxGeometry(2.6,2.4,2.6),proxy);m.position.set(x,by+1.2,z);m.name='Paint Lab bush clearance';scene.add(m);solids.push(m);
 }
 // grass: tufts everywhere the meadow is, none on the path
 const tufts=low?4500:9000;
 for(let i=0;i<tufts;i++){
  const a=rnd()*6.28,r=Math.sqrt(rnd())*15.5,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(onPath(x,z)||Math.hypot(x-T.x,z-T.z)<.6)continue;
  const tall=.16+rnd()*.14+(r>11?.08:0);
  grass.add(x,paintLabHeight(x,z)-.02,z,{w:.1,h:tall,turn:(rnd()-.5)*.5,seed:rnd(),kind:1,colour:shadeHex(['#8fb866','#a6c06c','#7ea65e','#b9c775'][i%4],.95+rnd()*.1),root:[x,paintLabHeight(x,z),z,0],line:rnd()<.06});
 }
 const dabMesh=dabs.build('Paint Lab touches'),grassMesh=grass.build('Paint Lab grass');
 const grassTotal=grass.count;
 scene.add(dabMesh,grassMesh);

 const sky=new THREE.Mesh(new THREE.SphereGeometry(300,32,16),skyMaterial(shared,skyAt));sky.name='Paint Lab sky';sky.frustumCulled=false;sky.renderOrder=-1;scene.add(sky);
 scene.updateMatrixWorld(true);

 // --- the paint ---
 let dirty=false,lastTouch:{x:number;z:number}|undefined,flooded=false;
 const cell=MAP_SIZE/MAP_CELLS;
 function touch(x:number,z:number,now:number,reach=REACH){
  const i0=Math.max(0,Math.floor((x-reach-MAP_X0)/cell)),i1=Math.min(MAP_CELLS-1,Math.ceil((x+reach-MAP_X0)/cell));
  const j0=Math.max(0,Math.floor((z-reach-MAP_Z0)/cell)),j1=Math.min(MAP_CELLS-1,Math.ceil((z+reach-MAP_Z0)/cell));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
   const cx=MAP_X0+(i+.5)*cell,cz=MAP_Z0+(j+.5)*cell,d=Math.hypot(cx-x,cz-z);
   // (an uneven wet edge: further in some directions than others)
   const rag=reach*(.75+.25*Math.sin(Math.atan2(cz-z,cx-x)*3+x*.7)+.12*Math.sin(cx*1.7+cz*1.3));
   if(d>rag)continue;
   const at=now+d/SPREAD,k=j*MAP_CELLS+i;if(data[k]<-1e8||at<data[k]){data[k]=at;dirty=true;}
  }
 }
 function flood(x:number,z:number,now:number){
  for(let j=0;j<MAP_CELLS;j++)for(let i=0;i<MAP_CELLS;i++){const cx=MAP_X0+(i+.5)*cell,cz=MAP_Z0+(j+.5)*cell,at=now+.8+Math.hypot(cx-x,cz-z)/7,k=j*MAP_CELLS+i;if(data[k]<-1e8||at<data[k])data[k]=at;}
  dirty=true;skyAt.value=Math.min(skyAt.value,now+3);
 }
 const door={...PAINT_LAB.door,y:paintLabHeight(PAINT_LAB.door.x,PAINT_LAB.door.z)};
 let clock=0;
 return {scene,floor,solids,door,heightAt:paintLabHeight,
  /** time: the portal clock. hero: Hero's feet while Hero is in the glade. */
  update(time:number,hero?:{x:number;z:number}){
   clock=time;shared.uNow.value=time;shared.uTime.value=reduced?0:time;
   if(hero){
    if(!lastTouch||Math.hypot(hero.x-lastTouch.x,hero.z-lastTouch.z)>.3){touch(hero.x,hero.z,time);lastTouch={x:hero.x,z:hero.z};}
    if(!flooded&&Math.hypot(hero.x-T.x,hero.z-T.z)<3.2){flooded=true;flood(T.x,T.z,time);}
   }
   if(dirty){map.needsUpdate=true;dirty=false;}
  },
  setLow(){grassMesh.geometry.instanceCount=Math.round(grassTotal*.5);},
  /** Paints the whole glade at once (e.g. for a still). */
  paintAll(){flood(T.x,T.z,clock-30);},
  get diagnostics(){return {paintLab:true,dabs:dabs.count,grass:grassMesh.geometry.instanceCount,flooded};},
 };
}

function mergeParts(parts:THREE.BufferGeometry[]){
 let total=0;for(const p of parts)total+=p.attributes.position.count;
 const out=new THREE.BufferGeometry(),names=['position','normal','pigment','root'] as const,size={position:3,normal:3,pigment:3,root:4};
 for(const name of names){const arr=new Float32Array(total*size[name]);let o=0;for(const p of parts){const a=p.attributes[name].array as Float32Array;arr.set(a,o);o+=a.length;}out.setAttribute(name,new THREE.BufferAttribute(arr,size[name]));}
 out.computeBoundingSphere();return out;
}

export function createWorldPaintLab(low:boolean,reduced:boolean){
 const art=createPaintLabArt(low,reduced);
 const cameraOccluders=[art.floor,...art.solids];
 const terrain=createMeadowTerrain(cameraOccluders,{minX:-23,maxX:23,minZ:-23,maxZ:23,minY:-1.2,cellSize:4});
 const surface=createMeadowSurface(terrain,art.heightAt);
 const navigation=createMeadowNavigation(terrain,{spacing:1,triangleCenters:false});
 const door={...art.door,y:surface.height(art.door.x,art.door.z)};
 const T=PAINT_LAB.tree;
 return {scene:art.scene,floors:[art.floor] as THREE.Mesh[],scenery:[] as THREE.Mesh[],cameraOccluders,surface,terrain,navigation,dry:terrain.dry,door,start:PAINT_LAB.start,
  canTravel(a:{x:number;z:number},b:{x:number;z:number}){return terrain.canWalk({...a,y:surface.height(a.x,a.z)},{...b,y:surface.height(b.x,b.z)});},
  landmarks:[{id:'paint-lab-tree',point:new THREE.Vector3(T.x,paintLabHeight(T.x,T.z)+4.5,T.z),radius:4,halfHeight:4,priority:1}],
  art:{update:art.update,setLow:art.setLow,paintAll:art.paintAll,get diagnostics(){return {...art.diagnostics,groundTriangles:terrain.triangles.length};}},
 };
}
