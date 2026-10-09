import type { CameraState } from '../../hooks/useCameraControls';
import { DEFAULT_LIGHT_COLOR, DEFAULT_LIGHT_RADIUS, DEFAULT_LIGHT_STRENGTH, hexToRgb, lightFlicker, type TableLight, type TableLightFrame } from '../protoLighting';
import type { TableTilt } from '../tableTilt';
import { ATMOSPHERE_ATLAS_SIZE, ATMOSPHERE_EXTENT, ATMOSPHERE_HEIGHT, atmosphereSky, projectAtmospherePoint, type AtmosphereCanopy, type AtmosphereScene } from '../volumetricAtmosphere';
import { seeded } from '../atmosphere';
import { projectBillboard } from '../actorOcclusion';

type SpriteProfile = { image: HTMLImageElement; columns: number[]; aspect: number; bounds: [number, number, number, number] };
const sprites = new Map<string, Promise<SpriteProfile | null>>();

/** Once per asset, read its alpha. A tall empty rectangle must not block light:
 * pine tips and the spaces between reeds retain their actual height profile. */
const loadProfile = (src: string): Promise<SpriteProfile | null> => {
  let pending = sprites.get(src);
  if (!pending) {
    pending = new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(image, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;
        let left = 64, right = -1, top = 64, bottom = -1;
        const columns = Array<number>(64).fill(0);
        for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) {
          if (data[(y * 64 + x) * 4 + 3] < 40) continue;
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
          columns[x] = Math.max(columns[x], 64 - y);
        }
        if (right < left) return resolve(null);
        resolve({ image, columns, aspect: (right - left + 1) * image.width / ((bottom - top + 1) * image.height), bounds: [left, top, right + 1, bottom + 1] });
      };
      image.onerror = () => resolve(null); image.src = src;
    });
    sprites.set(src, pending);
  }
  return pending;
};

export type AtmosphereDraw = {
  width: number; height: number; camera: CameraState; tilt: TableTilt;
  frame: TableLightFrame; lights: readonly TableLight[]; time: number;
  scene: AtmosphereScene; scale: number;
  /** Screen rectangles protected from the veil: labels and camera controls. */
  guards: readonly { left: number; top: number; right: number; bottom: number }[];
};
export type AtmosphereRenderer = { kind: 'webgl' | 'canvas'; draw: (input: AtmosphereDraw) => void; dispose: () => void };

const VERTEX = `attribute vec2 aPosition;
void main(){ gl_Position=vec4(aPosition,0.0,1.0); }`;

const FRAGMENT = `precision highp float;
uniform vec2 uView;
uniform vec4 uCamera; // pan xy, scale, yaw
uniform vec3 uTilt; // cos, sin, perspective
uniform float uAimY;
uniform vec3 uColor;
uniform vec2 uSlope;
uniform float uStrength, uMist, uTime;
uniform sampler2D uAtlas, uSprites;
uniform vec4 uLights[4]; // position xy, radius, power
uniform vec3 uLightColor[4];
const float EXTENT=${ATMOSPHERE_EXTENT.toFixed(1)}, HEIGHT=${ATMOSPHERE_HEIGHT.toFixed(1)};
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
vec2 worldAt(vec2 screen,float z){
screen.y-=uAimY;
float y=(screen.y+z*uCamera.z)*uTilt.z/(uTilt.x*uTilt.z+screen.y*uTilt.y);
float x=screen.x*(uTilt.z-y*uTilt.y)/uTilt.z;
float c=cos(uCamera.w),s=sin(uCamera.w);
return (vec2(c*x+s*y,-s*x+c*y)-uCamera.xy)/uCamera.z; }
vec2 field(vec2 p){ vec2 uv=(p+EXTENT)/(2.0*EXTENT);
if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))return vec2(0);
return texture2D(uAtlas,uv).rg; }
float visibility(vec2 p,float z){
float shade=0.0;
// Four stratified taps toward the sky catch nearby and distant canopy shadows.
for(int j=0;j<4;j++){float dz=9.0+float(j)*18.0;
float h=field(p+uSlope*dz).r*HEIGHT;
shade=max(shade,smoothstep(z+dz-3.0,z+dz+3.0,h));}
return 1.0-shade*0.94; }
float aperture(vec2 p,float z){
float y=p.y-uSlope.y*(z-60.0);
return exp(-pow((y+48.0)/38.0,2.0)); }
float beams(vec2 p,float z){
// Anchor the beam openings at canopy height, so low sun sweeps the landing
// areas across the table instead of pushing every opening away from the woods.
float x=p.x-uSlope.x*(z-60.0);
float broad=pow(max(0.0,sin(x*0.017+0.9)),3.0);
float streak=pow(max(0.0,sin(x*0.061+sin(x*0.009)*1.7)),6.0);
return 0.02+(broad*0.90+streak*0.30)*aperture(p,z); }
void main(){
vec2 pixel=vec2(gl_FragCoord.x,uView.y-gl_FragCoord.y);
vec2 screen=pixel-uView*0.5;
vec3 scatter=vec3(0);float trans=1.0;
// Integrate front-to-back through a shallow billboard volume. Fixed work per
// pixel; only the render target scales down when frames are slow.
for(int i=0;i<8;i++){
float z=HEIGHT*(1.0-(float(i)+0.5)/8.0);
vec2 p=worldAt(screen,z);vec2 f=field(p);
float inside=1.0-smoothstep(345.0,420.0,max(abs(p.x),abs(p.y)));
float n=noise(p*0.016+vec2(uTime*0.018,z*0.014));
float detail=noise(p*0.043-vec2(uTime*0.009,z*0.027));
float density=(0.016+f.g*0.070)*mix(0.4,1.35,n)*mix(0.7,1.2,detail)*inside;
// Most air sits at scenery height. A thin density band keeps grazing rays
// distinct instead of averaging several adjacent beams into a blanket veil.
density*=(0.12+exp(-pow((z-46.0)/30.0,2.0)))*uMist;
density*=0.35+aperture(p,z)*2.0;
float vis=visibility(p,z);
float beam=beams(p,z)*vis;
vec3 light=uColor*(0.035+beam*uStrength*7.0);
for(int k=0;k<4;k++){
float d=length(vec3(p-uLights[k].xy,z-16.0));
float fall=max(0.0,1.0-d/max(1.0,uLights[k].z));
light+=uLightColor[k]*fall*fall*uLights[k].w*(1.0-step(360.0,max(abs(p.x),abs(p.y))));
}
float extinction=1.0-exp(-density*1.8);
light=light/(vec3(1.0)+light);
scatter+=trans*extinction*light;trans*=1.0-extinction;
}
// Black alpha marks sprite ink; red marks protected labels and controls.
vec4 guard=texture2D(uSprites,pixel/uView);
float protect=(1.0-guard.a*0.92)*(1.0-guard.r*0.95);
// Premultiplied output; a small cool extinction veil gives the bright air body.
float alpha=(1.0-trans)*0.85*protect;
vec3 fog=vec3(0.040,0.052,0.064)*alpha;
gl_FragColor=vec4((scatter*0.85+fog)*protect,alpha);
}`;

/** Cached world atlas: R canopy height, G biome mist density. Camera movement
 * only changes shader uniforms. Rebuild when scenery or its facing changes. */
class SceneAtlas {
  canvas = document.createElement('canvas');
  mask = document.createElement('canvas');
  profiles = new Map<string, SpriteProfile | null>();
  private key = '';
  private dirty = true;
  private revision = 0;
  private maskKey = '';
  constructor() { this.canvas.width = this.canvas.height = ATMOSPHERE_ATLAS_SIZE; }
  update(scene: AtmosphereScene, yaw: number) {
    const casters = scene.canopies.filter(c=>c.castsShadow!==false);
    const key = JSON.stringify([casters,scene.patches,casters.some(c=>c.worldHeading===undefined) ? Math.round(yaw) : 0]);
    if (key !== this.key) { this.key = key; this.dirty = true; }
    for (const canopy of scene.canopies) if (!this.profiles.has(canopy.sprite)) {
      this.profiles.set(canopy.sprite, null);
      loadProfile(canopy.sprite).then(profile => { this.profiles.set(canopy.sprite, profile); this.dirty = true; });
    }
    if (!this.dirty) return false;
    this.dirty = false;
    this.revision++;
    const ctx = this.canvas.getContext('2d')!;
    const scale = ATMOSPHERE_ATLAS_SIZE / (ATMOSPHERE_EXTENT * 2);
    ctx.setTransform(scale, 0, 0, scale, ATMOSPHERE_ATLAS_SIZE / 2, ATMOSPHERE_ATLAS_SIZE / 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000';
    ctx.fillRect(-ATMOSPHERE_EXTENT, -ATMOSPHERE_EXTENT, ATMOSPHERE_EXTENT * 2, ATMOSPHERE_EXTENT * 2);
    ctx.globalCompositeOperation = 'lighten';
    for (const c of scene.canopies) {
      if(c.castsShadow===false)continue;
      const profile = this.profiles.get(c.sprite);
      if (!profile) continue;
      const [left, top, right, bottom] = c.trimmed ? profile.bounds : [0, 0, 64, 64];
      const h = c.trimmed ? Math.min(c.height, c.width / profile.aspect) : c.height;
      const w = c.trimmed ? h * profile.aspect : c.width;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-(c.worldHeading ?? yaw * Math.PI / 180));
      for (let column = left; column < right; column++) {
        const height = Math.max(0, profile.columns[column] - (64 - bottom)) / Math.max(1, bottom - top) * h;
        if (!height) continue;
        const x = ((column - left) / (right - left) - 0.5) * w;
        ctx.fillStyle = `rgb(${Math.round(Math.min(1, height / ATMOSPHERE_HEIGHT) * 255)},0,0)`;
        ctx.fillRect(c.flip ? -x - w / (right - left) : x, -5, w / (right - left) + 0.6, 10);
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const patch of scene.patches) {
      const radius = Math.max(patch.width, patch.height) * 0.5 + 65;
      const mist = ctx.createRadialGradient(patch.x, patch.y, 0, patch.x, patch.y, radius);
      mist.addColorStop(0, patch.terrain === 'water' ? '#00b000' : '#007800'); mist.addColorStop(1, '#00000000');
      ctx.fillStyle = mist; ctx.fillRect(patch.x - radius, patch.y - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    return true;
  }
  updateMask(input: AtmosphereDraw) {
    const { width,height,scale,camera,tilt,scene } = input;
    const key=JSON.stringify([this.key,this.revision,scene.canopies,input.guards,width,height,scale,camera,tilt]);
    if(key===this.maskKey)return false;
    this.maskKey=key;
    this.mask.width=Math.max(1,Math.round(width*scale));this.mask.height=Math.max(1,Math.round(height*scale));
    const ctx=this.mask.getContext('2d')!;
    ctx.setTransform(scale,0,0,scale,width*scale/2,height*scale/2);
    for(const c of scene.canopies){
      const profile=this.profiles.get(c.sprite);if(!profile)continue;
      const [l,t,r,b]=c.trimmed?profile.bounds:[0,0,64,64];
      const h=c.trimmed?Math.min(c.height,c.width/profile.aspect):c.height;
      const w=c.trimmed?h*profile.aspect:c.width;
      const foot=projectAtmospherePoint(c,0,camera,tilt),top=projectAtmospherePoint(c,h,camera,tilt);
      const face=c.worldHeading === undefined ? null : projectBillboard({...c,width:w,height:h},camera,tilt);
      const drawnH=face ? face.bottom-face.top : foot.y-top.y,drawnW=face ? face.right-face.left : w*drawnH/h;
      if(face){foot.x=(face.left+face.right)/2;foot.y=face.bottom;}
      const backFace=c.worldHeading !== undefined && Math.cos((camera.yaw ?? 0)*Math.PI/180-c.worldHeading)<0;
      ctx.save();ctx.translate(foot.x,foot.y);if(Boolean(c.flip)!==backFace)ctx.scale(-1,1);
      ctx.drawImage(profile.image,l/64*profile.image.width,t/64*profile.image.height,(r-l)/64*profile.image.width,(b-t)/64*profile.image.height,-drawnW/2,-drawnH,drawnW,drawnH);
      ctx.restore();
    }
    ctx.globalCompositeOperation='source-in';ctx.fillStyle='#000';ctx.fillRect(-width/2,-height/2,width,height);
    ctx.globalCompositeOperation='source-over';ctx.fillStyle='#ff0000';
    ctx.shadowColor='#ff0000';ctx.shadowBlur=3;
    for(const r of input.guards)ctx.fillRect(r.left-width/2-2,r.top-height/2-2,r.right-r.left+4,r.bottom-r.top+4);
    ctx.shadowBlur=0;
    return true;
  }
}

const createGpu = (canvas: HTMLCanvasElement): AtmosphereRenderer | null => {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) { if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); return null; }
  const program = gl.createProgram()!; gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  gl.useProgram(program); const pos = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const atlas = new SceneAtlas(), texture = gl.createTexture()!, maskTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,maskTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => { if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name)); return uniforms.get(name)!; };
  return { kind: 'webgl', draw(input) {
    const { width, height, camera, tilt, frame, time, scene } = input;
    const scale=Math.min(input.scale,512/width,320/height);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h); gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(u('uAtlas'),0);
    if (atlas.update(scene, camera.yaw ?? 0)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,maskTexture);gl.uniform1i(u('uSprites'),1);
    if(atlas.updateMask({...input,scale}))gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas.mask);
    const sky = atmosphereSky(frame), angle = tilt.angle * Math.PI / 180;
    // gl_FragCoord is in render pixels; the shader ray needs CSS pixels.
    gl.uniform2f(u('uView'), w, h);
    gl.uniform4f(u('uCamera'), camera.x * scale, camera.y * scale, camera.scale * scale, (camera.yaw ?? 0) * Math.PI / 180);
    gl.uniform3f(u('uTilt'), Math.cos(angle), Math.sin(angle), tilt.perspective * scale);
    gl.uniform1f(u('uAimY'), (tilt.aimY ?? 0) * scale);
    gl.uniform3f(u('uColor'), sky.color.r / 255, sky.color.g / 255, sky.color.b / 255);
    gl.uniform2f(u('uSlope'), sky.slope.x, sky.slope.y);
    gl.uniform1f(u('uStrength'), sky.strength); gl.uniform1f(u('uMist'), sky.mist); gl.uniform1f(u('uTime'), time / 1000);
    // Choose only nearby lights. No atmospheric local glow leaks onto terrain.
    const lights = input.lights.filter(l => Math.abs(l.position.x) <= 360 && Math.abs(l.position.y) <= 360)
      .sort((a,b) => (b.strength ?? DEFAULT_LIGHT_STRENGTH) - (a.strength ?? DEFAULT_LIGHT_STRENGTH)).slice(0, 4);
    const values = new Float32Array(16), colors = new Float32Array(12);
    lights.forEach((l, index) => {
      const color = hexToRgb(l.color ?? DEFAULT_LIGHT_COLOR);
      values.set([l.position.x, l.position.y, (l.radius ?? DEFAULT_LIGHT_RADIUS) * 48, (l.strength ?? DEFAULT_LIGHT_STRENGTH) * lightFlicker(l, time) * (1-frame.daylight)], index * 4);
      colors.set([color.r/255,color.g/255,color.b/255],index*3);
    });
    gl.uniform4fv(u('uLights[0]'),values); gl.uniform3fv(u('uLightColor[0]'),colors);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, dispose() { gl.deleteTexture(texture);gl.deleteTexture(maskTexture); gl.deleteBuffer(buffer); gl.deleteProgram(program); } };
};

/** A bounded 2D fallback still connects shafts to scenery. It shares the clock,
 * scene and camera and never relies on WebGL to keep the board playable. */
const createCanvas = (canvas: HTMLCanvasElement): AtmosphereRenderer => {
  const ctx = canvas.getContext('2d')!, atlas = new SceneAtlas();
  return { kind: 'canvas', draw(input) {
    const { width, height, camera, tilt, frame, scene } = input;
    const scale=Math.min(input.scale,512/width,320/height);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(scale,0,0,scale,width*scale/2,height*scale/2); ctx.clearRect(-width/2,-height/2,width,height);
    const sky = atmosphereSky(frame);
    for (let slot=-5;slot<=5;slot++) {
      const next = seeded(`volume-${slot}`), x=slot*95+next()*35;
      const foot={x,y:-40+next()*80}, top={x:x+sky.slope.x*ATMOSPHERE_HEIGHT,y:foot.y+sky.slope.y*ATMOSPHERE_HEIGHT};
      const a=projectAtmospherePoint(foot,0,camera,tilt), b=projectAtmospherePoint(top,ATMOSPHERE_HEIGHT,camera,tilt);
      const band=25+next()*25;
      const gradient=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
      gradient.addColorStop(0,`rgba(${sky.color.r},${sky.color.g},${sky.color.b},0)`);
      gradient.addColorStop(0.55,`rgba(${sky.color.r},${sky.color.g},${sky.color.b},${sky.strength*0.12})`);
      gradient.addColorStop(1,'transparent'); ctx.fillStyle=gradient;
      ctx.beginPath();ctx.moveTo(a.x-band*camera.scale,a.y);ctx.lineTo(a.x+band*camera.scale,a.y);
      ctx.lineTo(b.x+band*camera.scale,b.y);ctx.lineTo(b.x-band*camera.scale,b.y);ctx.closePath();ctx.fill();
    }
    atlas.update(scene,camera.yaw??0);
    ctx.globalCompositeOperation='destination-out';
    for(const c of scene.canopies){
      const profile=atlas.profiles.get(c.sprite);if(!profile)continue;
      const foot=projectAtmospherePoint(c,0,camera,tilt), top=projectAtmospherePoint(c,c.height,camera,tilt);
      const face=c.worldHeading === undefined ? null : projectBillboard(c,camera,tilt);
      const drawnH=face ? face.bottom-face.top : foot.y-top.y, drawnW=face ? face.right-face.left : c.width*drawnH/c.height;
      if(face){foot.x=(face.left+face.right)/2;top.y=face.top;}
      const [l,t,r,b]=c.trimmed?profile.bounds:[0,0,64,64];
      const backFace=c.worldHeading !== undefined && Math.cos((camera.yaw ?? 0)*Math.PI/180-c.worldHeading)<0;
      ctx.save();ctx.translate(foot.x,top.y);if(Boolean(c.flip)!==backFace)ctx.scale(-1,1);
      ctx.drawImage(profile.image,l/64*profile.image.width,t/64*profile.image.height,(r-l)/64*profile.image.width,(b-t)/64*profile.image.height,-drawnW/2,0,drawnW,drawnH);
      ctx.restore();
    }
    ctx.globalCompositeOperation='source-over';
    for(const r of input.guards)ctx.clearRect(r.left-width/2-3,r.top-height/2-3,r.right-r.left+6,r.bottom-r.top+6);
  },dispose(){} };
};

export const createAtmosphereRenderer = (canvas: HTMLCanvasElement, forceCanvas = false): AtmosphereRenderer => {
  if (!forceCanvas) {
    const renderer = createGpu(canvas); if (renderer) return renderer;
    // A canvas which has acquired WebGL cannot acquire 2D, even after failure.
    // The component replaces it before requesting the fallback.
    throw new Error('Atmosphere WebGL unavailable');
  }
  return createCanvas(canvas);
};
