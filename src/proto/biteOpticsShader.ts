import {FAST_SWIPE_GATES,FAST_SWIPE_POSES} from './fastSwipesLenticular';
/** An artistic lens-array approximation: interlaced views, refraction and rib highlights.
 * No optical diffraction simulation and no time uniform / autonomous animation. */
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;
uniform sampler2D closedFrame,partedFrame,halfFrame,openFrame,sky;
uniform vec2 view,resolution;
uniform float lenses,strength,swipeMode;
uniform float skyAspect;
const float TAU=6.2831853;
vec2 cover(vec2 p,float imageAspect,float anchor){
 float aspect=resolution.x/resolution.y;
 if(aspect<imageAspect)p.x=p.x*(aspect/imageAspect)+anchor*(1.-aspect/imageAspect);
 else p.y=(p.y-.5)*(imageAspect/aspect)+.5;
 return p;
}
vec4 premul(vec4 c){return vec4(c.rgb*c.a,c.a);}
vec3 over(vec4 layer,vec3 base){return layer.rgb+base*(1.-layer.a);}
// Only three pose exchanges across the whole -1..1 tilt range, with no repeat.
vec4 slapSubject(vec2 p,float lensPhase){
 float lateral=view.x+(lensPhase-.5)*.024;
 if(lateral<${FAST_SWIPE_GATES[0].toFixed(3)})return premul(texture2D(closedFrame,p));
 if(lateral<${FAST_SWIPE_GATES[1].toFixed(3)})return premul(texture2D(partedFrame,p));
 if(lateral<${FAST_SWIPE_GATES[2].toFixed(3)})return premul(texture2D(halfFrame,p));
 return premul(texture2D(openFrame,p));
}
float gate(float a,float start,float phase){
 float travel=clamp((a-start)/.05,0.,1.);
 // Adjacent jaw states exchange through lens slivers, rather than one global dissolve.
 return mix(travel,smoothstep(phase-.07,phase+.07,travel),strength);
}
vec4 subject(vec2 p,float a,float phase){
 vec4 c=premul(texture2D(closedFrame,p));
 c=mix(c,premul(texture2D(partedFrame,p)),gate(a,.20,phase));
 c=mix(c,premul(texture2D(halfFrame,p)),gate(a,.47,phase));
 return mix(c,premul(texture2D(openFrame,p)),gate(a,.74,phase));
}
vec3 plate(vec2 p,float a,float phase){
 if(swipeMode>.5){
  vec2 q=(vec2(p.x,1.-p.y)-vec2(-.24,.01))/vec2(1.45,1.10);
  float r=1.45*resolution.x/(1.10*resolution.y);
  if(r<1.5)q.x=q.x*r/1.5+.56*(1.-r/1.5);else q.y=(q.y-.4)*1.5/r+.4;
  vec4 body=slapSubject(vec2(q.x,1.-q.y),phase);
  vec3 bg=texture2D(sky,cover((p-.5)/1.16+.5+view*.02,skyAspect,.5)).rgb*.6;
  return over(body,bg);
 }
 vec4 c=subject(cover(p-view*.012,1.5,.65),a,phase);
 vec3 bg=texture2D(sky,cover((p-.5)/1.16+.5+view*.03,skyAspect,.5)).rgb*.72;
 return c.rgb+bg*(1.-c.a);
}
void main(){
 float angle=abs(view.x);
 float lens=fract(uv.x*lenses+view.x*1.3+view.y*.12);
 float rib=sin(lens*TAU);
 // Mild perspective disagreement across the card and individual cylindrical lenses.
 float sequence=angle; // Fast Swipes uses three non-repeating signed gates inside plate().
 float localAngle=clamp(sequence+(uv.x-.5)*.035*strength+rib*.014*strength,0.,1.);
 // The clear lens sheet acts on the complete printed plate, including static fur
 // and forest. Keep this gain independent of the already-tuned jaw exchange.
 float coat=strength*1.8;
 vec2 bend=vec2(rib*.0033,cos(lens*TAU)*(.0005+abs(view.y)*.0006))*coat*(.7+angle*.3);
 vec2 p=uv+bend;
 vec3 color=plate(p,localAngle,lens);
 float split=.0018*coat*(.45+angle*.55);
 vec3 red=plate(p+vec2(split,0.),localAngle,lens);
 vec3 blue=plate(p-vec2(split,0.),localAngle,lens);
 color=mix(color,vec3(red.r,color.g,blue.b),.55);
 // Every lens carries a visible ridge/glint even away from a frame transition.
 float glint=pow(max(0.,cos((lens-.25-view.x*.12)*TAU)),18.);
 float broad=pow(max(0.,1.-abs(uv.x-(.5+view.x*.32))*1.8),6.);
 vec3 pearl=.5+.5*cos(vec3(0.,2.1,4.2)+uv.x*5.+view.x*4.);
 color*=1.+rib*.065*coat*(.75+angle*.25);
 color+=coat*(glint*.10*(.7+angle*.3)+broad*.018)*mix(vec3(1.),pearl,.35);
 gl_FragColor=vec4(color,1.);
}`;

export type LenticularProfile='bite'|'fast-swipes';
export async function createBiteOpticsRenderer(canvas:HTMLCanvasElement,profile:LenticularProfile='bite'){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
 if(!gl)throw new Error('WebGL unavailable');
 const shaders:WebGLShader[]=[],textures:WebGLTexture[]=[];
 let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null;
 const dispose=()=>{textures.forEach(texture=>{if(gl.isTexture(texture))gl.deleteTexture(texture);});shaders.forEach(shader=>{if(gl.isShader(shader))gl.deleteShader(shader);});if(buffer&&gl.isBuffer(buffer))gl.deleteBuffer(buffer);if(program&&gl.isProgram(program))gl.deleteProgram(program);};
 try{
  const compile=(type:number,source:string)=>{const shader=gl.createShader(type);if(!shader)throw new Error('Shader allocation failed');shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)??'Shader compile failed');return shader;};
  program=gl.createProgram();if(!program)throw new Error('Program allocation failed');gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??'Shader link failed');
  gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const base=import.meta.env.BASE_URL;
  const urls=profile==='bite'?['closed','parted','half','open'].map(name=>`${base}assets/runtime/ui/holocards/hero-bite/v2/bite-${name}.png`):FAST_SWIPE_POSES.map(name=>`${base}assets/runtime/ui/holocards/mochi-fast-swipes/v6/swipe-${name}.png`);
  urls.push(`${base}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`);
  const images=await Promise.all(urls.map(async url=>{const image=new Image();image.src=url;await image.decode();return image;}));
  // StrictMode or a settings change may prepare another program during decoding.
  gl.useProgram(program);
  const samplers=['closedFrame','partedFrame','halfFrame','openFrame','sky'];
  images.forEach((image,index)=>{
   // Bound texture memory per card; masters and their original alpha remain untouched.
   const upload=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(image.width,image.height));upload.width=Math.round(image.width*scale);upload.height=Math.round(image.height*scale);const context=upload.getContext('2d');if(!context)throw new Error('Texture staging unavailable');context.drawImage(image,0,0,upload.width,upload.height);
   const texture=gl.createTexture();if(!texture)throw new Error('Texture allocation failed');textures.push(texture);gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,upload);gl.uniform1i(gl.getUniformLocation(program!,samplers[index]),index);
  });
  const uniforms=Object.fromEntries(['view','resolution','lenses','strength'].map(name=>[name,gl.getUniformLocation(program!,name)]));gl.uniform1f(gl.getUniformLocation(program,'skyAspect'),images[4].width/images[4].height);
  gl.uniform1f(gl.getUniformLocation(program,'swipeMode'),profile==='fast-swipes'?1:0);
  return {dispose,draw(x:number,y:number,width:number,height:number,strength:number,pitch:number){
   const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.min(1200,Math.round(width*dpr))),h=Math.max(1,Math.min(1600,Math.round(height*dpr)));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   gl.viewport(0,0,w,h);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);textures.forEach((texture,index)=>{gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);});gl.uniform2f(uniforms.view,x,y);gl.uniform2f(uniforms.resolution,w,h);gl.uniform1f(uniforms.lenses,width/pitch);gl.uniform1f(uniforms.strength,strength);gl.drawArrays(gl.TRIANGLES,0,6);
  }};
 }catch(error){dispose();throw error;}
}




