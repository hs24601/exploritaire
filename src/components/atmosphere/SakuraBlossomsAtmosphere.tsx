// @ts-nocheck
import { memo, useEffect, useRef } from 'react';

// ─── Shader Sources ───────────────────────────────────────────────────────────

const SAKURA_POINT_VSH = `
uniform mat4 uProjection;
uniform mat4 uModelview;
uniform vec3 uResolution;
uniform vec3 uOffset;
uniform vec3 uDOF;
uniform vec3 uFade;
attribute vec3 aPosition;
attribute vec3 aEuler;
attribute vec2 aMisc;
varying vec3 pposition;
varying float psize;
varying float palpha;
varying float pdist;
varying vec3 normX;
varying vec3 normY;
varying vec3 normZ;
varying vec3 normal;
varying float diffuse;
varying float specular;
varying float rstop;
varying float distancefade;
void main(void) {
  vec4 pos = uModelview * vec4(aPosition + uOffset, 1.0);
  gl_Position = uProjection * pos;
  gl_PointSize = aMisc.x * uProjection[1][1] / -pos.z * uResolution.y * 0.5;
  pposition = pos.xyz;
  psize = aMisc.x;
  pdist = length(pos.xyz);
  palpha = smoothstep(0.0, 1.0, (pdist - 0.1) / uFade.z);
  vec3 elrsn = sin(aEuler);
  vec3 elrcs = cos(aEuler);
  mat3 rotx = mat3(1.0,0.0,0.0, 0.0,elrcs.x,elrsn.x, 0.0,-elrsn.x,elrcs.x);
  mat3 roty = mat3(elrcs.y,0.0,-elrsn.y, 0.0,1.0,0.0, elrsn.y,0.0,elrcs.y);
  mat3 rotz = mat3(elrcs.z,elrsn.z,0.0, -elrsn.z,elrcs.z,0.0, 0.0,0.0,1.0);
  mat3 rotmat = rotx * roty * rotz;
  normal = rotmat[2];
  mat3 trrotm = mat3(
    rotmat[0][0], rotmat[1][0], rotmat[2][0],
    rotmat[0][1], rotmat[1][1], rotmat[2][1],
    rotmat[0][2], rotmat[1][2], rotmat[2][2]
  );
  normX = trrotm[0];
  normY = trrotm[1];
  normZ = trrotm[2];
  const vec3 lit = vec3(0.6917144638660746, 0.6917144638660746, -0.20751433915982237);
  float tmpdfs = dot(lit, normal);
  if(tmpdfs < 0.0) { normal = -normal; tmpdfs = dot(lit, normal); }
  diffuse = 0.4 + tmpdfs;
  vec3 eyev = normalize(-pos.xyz);
  if(dot(eyev, normal) > 0.0) {
    vec3 hv = normalize(eyev + lit);
    specular = pow(max(dot(hv, normal), 0.0), 20.0);
  } else {
    specular = 0.0;
  }
  rstop = clamp((abs(pdist - uDOF.x) - uDOF.y) / uDOF.z, 0.0, 1.0);
  rstop = pow(rstop, 0.5);
  distancefade = min(1.0, exp((uFade.x - pdist) * 0.69315 / uFade.y));
}
`;

const SAKURA_POINT_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform vec3 uDOF;
uniform vec3 uFade;
const vec3 fadeCol = vec3(0.08, 0.03, 0.06);
varying vec3 pposition;
varying float psize;
varying float palpha;
varying float pdist;
varying vec3 normX;
varying vec3 normY;
varying vec3 normZ;
varying vec3 normal;
varying float diffuse;
varying float specular;
varying float rstop;
varying float distancefade;
float ellipse(vec2 p, vec2 o, vec2 r) {
  vec2 lp = (p - o) / r;
  return length(lp) - 1.0;
}
void main(void) {
  vec3 p = vec3(gl_PointCoord - vec2(0.5, 0.5), 0.0) * 2.0;
  vec3 d = vec3(0.0, 0.0, -1.0);
  float nd = normZ.z;
  if(abs(nd) < 0.0001) discard;
  float np = dot(normZ, p);
  vec3 tp = p + d * np / nd;
  vec2 coord = vec2(dot(normX, tp), dot(normY, tp));
  const float flwrsn = 0.258819045102521;
  const float flwrcs = 0.965925826289068;
  mat2 flwrm = mat2(flwrcs, -flwrsn, flwrsn, flwrcs);
  vec2 flwrp = vec2(abs(coord.x), coord.y) * flwrm;
  float r;
  if(flwrp.x < 0.0) {
    r = ellipse(flwrp, vec2(0.065, 0.024) * 0.5, vec2(0.36, 0.96) * 0.5);
  } else {
    r = ellipse(flwrp, vec2(0.065, 0.024) * 0.5, vec2(0.58, 0.96) * 0.5);
  }
  if(r > rstop) discard;
  vec3 col = mix(vec3(1.0, 0.8, 0.75), vec3(1.0, 0.9, 0.87), r);
  float grady = mix(0.0, 1.0, pow(coord.y * 0.5 + 0.5, 0.35));
  col *= vec3(1.0, grady, grady);
  col *= mix(0.8, 1.0, pow(abs(coord.x), 0.3));
  col = col * diffuse + specular;
  col = mix(fadeCol, col, distancefade);
  float alpha = (rstop > 0.001) ? (0.5 - r / (rstop * 2.0)) : 1.0;
  alpha = smoothstep(0.0, 1.0, alpha) * palpha;
  gl_FragColor = vec4(col * 0.5, alpha);
}
`;

const FX_COMMON_VSH = `
uniform vec3 uResolution;
attribute vec2 aPosition;
varying vec2 texCoord;
varying vec2 screenCoord;
void main(void) {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  texCoord = aPosition.xy * 0.5 + vec2(0.5, 0.5);
  screenCoord = aPosition.xy * vec2(uResolution.z, 1.0);
}
`;

const BG_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform vec2 uTimes;
varying vec2 texCoord;
void main(void) {
  vec2 tmpv = texCoord * vec2(0.8, 1.0) - vec2(0.95, 1.0);
  float c = exp(-pow(length(tmpv) * 1.8, 2.0));
  vec3 col = mix(vec3(0.02, 0.0, 0.03), vec3(0.96, 0.98, 1.0) * 1.5, c);
  gl_FragColor = vec4(col * 0.5, 1.0);
}
`;

const FX_BRIGHTBUF_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D uSrc;
uniform vec2 uDelta;
varying vec2 texCoord;
void main(void) {
  vec4 col = texture2D(uSrc, texCoord);
  gl_FragColor = vec4(col.rgb * 2.0 - vec3(0.5), 1.0);
}
`;

const FX_DIRBLUR_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D uSrc;
uniform vec2 uDelta;
uniform vec4 uBlurDir;
varying vec2 texCoord;
void main(void) {
  vec4 col = texture2D(uSrc, texCoord);
  col += texture2D(uSrc, texCoord + uBlurDir.xy * uDelta);
  col += texture2D(uSrc, texCoord - uBlurDir.xy * uDelta);
  col += texture2D(uSrc, texCoord + (uBlurDir.xy + uBlurDir.zw) * uDelta);
  col += texture2D(uSrc, texCoord - (uBlurDir.xy + uBlurDir.zw) * uDelta);
  gl_FragColor = col / 5.0;
}
`;

const PP_FINAL_VSH = `
uniform vec3 uResolution;
attribute vec2 aPosition;
varying vec2 texCoord;
void main(void) {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  texCoord = aPosition.xy * 0.5 + vec2(0.5, 0.5);
}
`;

const PP_FINAL_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D uSrc;
uniform sampler2D uBloom;
uniform vec2 uDelta;
varying vec2 texCoord;
void main(void) {
  vec4 srccol = texture2D(uSrc, texCoord) * 2.0;
  vec4 bloomcol = texture2D(uBloom, texCoord);
  vec4 col = srccol + bloomcol * (vec4(1.0) + srccol);
  col *= smoothstep(1.0, 0.0, pow(length((texCoord - vec2(0.5)) * 2.0), 1.2) * 0.5);
  col = pow(col, vec4(0.45454545454545));
  gl_FragColor = vec4(col.rgb, 1.0);
}
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type V3 = { x: number; y: number; z: number; array?: Float32Array };

type SakuraProg = {
  prog: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attributes: Record<string, number>;
};

type EffectObj = { program: SakuraProg; buffer: WebGLBuffer };

type RT = {
  width: number; height: number;
  dtxArray: Float32Array;
  frameBuffer: WebGLFramebuffer;
  renderBuffer: WebGLRenderbuffer;
  texture: WebGLTexture;
};

// ─── Math Utilities ───────────────────────────────────────────────────────────

function v3(x: number, y: number, z: number): V3 { return { x, y, z }; }

function v3normalize(v: V3): void {
  const l = v.x * v.x + v.y * v.y + v.z * v.z;
  if (l > 0.00001) { const inv = 1.0 / Math.sqrt(l); v.x *= inv; v.y *= inv; v.z *= inv; }
}

function v3cross(out: V3, a: V3, b: V3): void {
  out.x = a.y * b.z - a.z * b.y;
  out.y = a.z * b.x - a.x * b.z;
  out.z = a.x * b.y - a.y * b.x;
}

function v3arr(v: V3): Float32Array {
  if (!v.array) v.array = new Float32Array(3);
  v.array[0] = v.x; v.array[1] = v.y; v.array[2] = v.z;
  return v.array;
}

function m44identity(): Float32Array {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

function m44projection(m: Float32Array, aspect: number, vdeg: number, near: number, far: number): void {
  const h = near * Math.tan(vdeg * Math.PI / 180.0 * 0.5) * 2.0;
  const w = h * aspect;
  m[0]=2*near/w; m[1]=0; m[2]=0; m[3]=0;
  m[4]=0; m[5]=2*near/h; m[6]=0; m[7]=0;
  m[8]=0; m[9]=0; m[10]=-(far+near)/(far-near); m[11]=-1;
  m[12]=0; m[13]=0; m[14]=-2*far*near/(far-near); m[15]=0;
}

function m44lookAt(m: Float32Array, vpos: V3, vlook: V3, vup: V3): void {
  const front = v3(vpos.x-vlook.x, vpos.y-vlook.y, vpos.z-vlook.z); v3normalize(front);
  const side  = v3(1,0,0); v3cross(side, vup, front);   v3normalize(side);
  const top   = v3(1,0,0); v3cross(top, front, side);   v3normalize(top);
  m[0]=side.x;  m[1]=top.x;  m[2]=front.x;  m[3]=0;
  m[4]=side.y;  m[5]=top.y;  m[6]=front.y;  m[7]=0;
  m[8]=side.z;  m[9]=top.z;  m[10]=front.z; m[11]=0;
  m[12]=-(vpos.x*m[0]+vpos.y*m[4]+vpos.z*m[8]);
  m[13]=-(vpos.x*m[1]+vpos.y*m[5]+vpos.z*m[9]);
  m[14]=-(vpos.x*m[2]+vpos.y*m[6]+vpos.z*m[10]);
  m[15]=1;
}

// ─── BlossomParticle ──────────────────────────────────────────────────────────

class BlossomParticle {
  velocity: [number,number,number] = [0,0,0];
  rotation: [number,number,number] = [0,0,0];
  position: [number,number,number] = [0,0,0];
  euler:    [number,number,number] = [0,0,0];
  size = 1.0;
  zkey = 0.0;

  setVelocity(x:number,y:number,z:number){ this.velocity=[x,y,z]; }
  setRotation(x:number,y:number,z:number){ this.rotation=[x,y,z]; }
  setPosition(x:number,y:number,z:number){ this.position=[x,y,z]; }
  setEulerAngles(x:number,y:number,z:number){ this.euler=[x,y,z]; }
  setSize(s:number){ this.size=s; }

  update(dt: number): void {
    for (let i=0;i<3;i++) {
      this.position[i] += this.velocity[i] * dt;
      this.euler[i]    += this.rotation[i] * dt;
    }
  }
}

// ─── WebGL Helpers ────────────────────────────────────────────────────────────

function mkRT(gl: WebGLRenderingContext, w: number, h: number): RT {
  const tex = gl.createTexture()!;
  const fb  = gl.createFramebuffer()!;
  const rb  = gl.createRenderbuffer()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  gl.bindRenderbuffer(gl.RENDERBUFFER,rb);
  gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
  gl.bindTexture(gl.TEXTURE_2D,null);
  gl.bindRenderbuffer(gl.RENDERBUFFER,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  return { width:w, height:h, dtxArray:new Float32Array([1/w,1/h]), frameBuffer:fb, renderBuffer:rb, texture:tex };
}

function rmRT(gl: WebGLRenderingContext, rt: RT): void {
  gl.deleteFramebuffer(rt.frameBuffer);
  gl.deleteRenderbuffer(rt.renderBuffer);
  gl.deleteTexture(rt.texture);
}

function mkShader(
  gl: WebGLRenderingContext,
  vtxSrc: string, frgSrc: string,
  uniforms: string[], attrs: string[],
): SakuraProg | null {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(s)); gl.deleteShader(s); return null;
    }
    return s;
  };
  const vsh = compile(gl.VERTEX_SHADER, vtxSrc);
  const fsh = compile(gl.FRAGMENT_SHADER, frgSrc);
  if (!vsh || !fsh) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog,vsh); gl.attachShader(prog,fsh);
  gl.deleteShader(vsh); gl.deleteShader(fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Link error:', gl.getProgramInfoLog(prog)); return null;
  }
  const u: Record<string,WebGLUniformLocation|null> = {};
  for (const n of uniforms) u[n] = gl.getUniformLocation(prog, n);
  const a: Record<string,number> = {};
  for (const n of attrs) a[n] = gl.getAttribLocation(prog, n);
  return { prog, uniforms:u, attributes:a };
}

function bindProg(gl: WebGLRenderingContext, p: SakuraProg): void {
  gl.useProgram(p.prog);
  for (const a in p.attributes) gl.enableVertexAttribArray(p.attributes[a]);
}

function unbindProg(gl: WebGLRenderingContext, p: SakuraProg): void {
  for (const a in p.attributes) gl.disableVertexAttribArray(p.attributes[a]);
  gl.useProgram(null);
}

function mkEffect(gl: WebGLRenderingContext, vtxSrc: string, frgSrc: string, extraUniforms: string[] = []): EffectObj | null {
  const p = mkShader(gl, vtxSrc, frgSrc, ['uResolution','uSrc','uDelta',...extraUniforms], ['aPosition']);
  if (!p) return null;
  bindProg(gl, p);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  unbindProg(gl, p);
  return { program:p, buffer:buf };
}

function applyEffect(gl: WebGLRenderingContext, fx: EffectObj, resArr: Float32Array, srcRT: RT | null): void {
  const p = fx.program;
  bindProg(gl, p);
  gl.uniform3fv(p.uniforms.uResolution, resArr);
  if (srcRT) {
    gl.uniform2fv(p.uniforms.uDelta, srcRT.dtxArray);
    gl.uniform1i(p.uniforms.uSrc, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcRT.texture);
  }
}

function drawEffect(gl: WebGLRenderingContext, fx: EffectObj): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, fx.buffer);
  gl.vertexAttribPointer(fx.program.attributes.aPosition, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = { className?: string };

export const SakuraBlossomsAtmosphere = memo(function SakuraBlossomsAtmosphere({ className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const canvas = document.createElement('canvas');
    canvas.width  = mount.clientWidth;
    canvas.height = mount.clientHeight;
    mount.appendChild(canvas);

    const gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) { console.error('SakuraBlossomsAtmosphere: WebGL not available'); mount.removeChild(canvas); return; }

    // ── Render targets ──────────────────────────────────────────────────────
    let mainRT:  RT, wFullRT0: RT, wFullRT1: RT, wHalfRT0: RT, wHalfRT1: RT;

    const resArr     = new Float32Array(3); // [w, h, aspect]
    const halfResArr = new Float32Array(3);

    function setViewports(w: number, h: number): void {
      canvas.width = w; canvas.height = h;
      resArr[0]=w; resArr[1]=h; resArr[2]=w/h;
      const hw = Math.floor(w/2), hh = Math.floor(h/2);
      halfResArr[0]=hw; halfResArr[1]=hh; halfResArr[2]=hw/hh;
      if (mainRT)   rmRT(gl!, mainRT);
      if (wFullRT0) rmRT(gl!, wFullRT0);
      if (wFullRT1) rmRT(gl!, wFullRT1);
      if (wHalfRT0) rmRT(gl!, wHalfRT0);
      if (wHalfRT1) rmRT(gl!, wHalfRT1);
      mainRT   = mkRT(gl!, w,  h);
      wFullRT0 = mkRT(gl!, w,  h);
      wFullRT1 = mkRT(gl!, w,  h);
      wHalfRT0 = mkRT(gl!, hw, hh);
      wHalfRT1 = mkRT(gl!, hw, hh);
    }

    setViewports(canvas.width, canvas.height);

    // ── Shaders ─────────────────────────────────────────────────────────────
    const flowerProg = mkShader(
      gl,
      SAKURA_POINT_VSH, SAKURA_POINT_FSH,
      ['uProjection','uModelview','uResolution','uOffset','uDOF','uFade'],
      ['aPosition','aEuler','aMisc'],
    );
    const fxBg       = mkEffect(gl, FX_COMMON_VSH, BG_FSH,         ['uTimes']);
    const fxBright   = mkEffect(gl, FX_COMMON_VSH, FX_BRIGHTBUF_FSH);
    const fxBlur     = mkEffect(gl, FX_COMMON_VSH, FX_DIRBLUR_FSH, ['uBlurDir']);
    const fxFinal    = mkEffect(gl, PP_FINAL_VSH,  PP_FINAL_FSH,   ['uBloom']);

    if (!flowerProg || !fxBg || !fxBright || !fxBlur || !fxFinal) {
      console.error('SakuraBlossomsAtmosphere: shader compile failed');
      mount.removeChild(canvas); return;
    }

    // ── Particles ───────────────────────────────────────────────────────────
    const NUM = 1600;
    const particles: BlossomParticle[] = Array.from({ length: NUM }, () => new BlossomParticle());
    const dataArray = new Float32Array(NUM * 8); // position(3) + euler(3) + misc(2)
    const posOff  = 0;
    const eulerOff = NUM * 3;
    const miscOff  = NUM * 6;

    const flowerBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, flowerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, dataArray, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const offset = new Float32Array(3);

    // ── Camera / Projection ─────────────────────────────────────────────────
    const projMat = m44identity();
    const camMat  = m44identity();
    const camPos  = v3(0, 0, 100);
    const camLook = v3(0, 0, 0);
    const camUp   = v3(0, 1, 0);
    const camDof  = v3(10.0, 4.0, 8.0);

    const area  = v3(20.0, 20.0, 20.0);
    const fader = v3(10.0, 20.0, 0.1);

    function initScene(): void {
      area.x = area.y * resArr[2]; // aspect correct x
      fader.x = 10.0;
      fader.y = area.z;
      fader.z = 0.1;
      camPos.z = area.z + 0.1;
      const projAngle = Math.atan2(area.y, camPos.z + area.z) * 180.0 / Math.PI * 2.0;
      m44projection(projMat, resArr[2], projAngle, 0.1, 100.0);

      const PI2 = Math.PI * 2;
      const sym = () => (Math.random() * 2 - 1);
      for (let i = 0; i < NUM; i++) {
        const p = particles[i];
        const vx = sym()*0.3+0.8, vy = sym()*0.2-1.0, vz = sym()*0.3+0.5;
        const vl = Math.sqrt(vx*vx+vy*vy+vz*vz);
        const spd = 2.0 + Math.random();
        p.setVelocity(vx/vl*spd, vy/vl*spd, vz/vl*spd);
        p.setRotation(sym()*PI2*0.5, sym()*PI2*0.5, sym()*PI2*0.5);
        p.setPosition(sym()*area.x, sym()*area.y, sym()*area.z);
        p.setEulerAngles(Math.random()*PI2, Math.random()*PI2, Math.random()*PI2);
        p.setSize(0.9 + Math.random()*0.1);
      }
    }

    initScene();

    // ── Animation ───────────────────────────────────────────────────────────
    let rafId = 0;
    const startTime = performance.now();
    let prevTime = startTime;

    function renderFlowers(dt: number): void {
      const PI2 = Math.PI * 2;
      const repeatPos = (p: BlossomParticle, c: number, lim: number) => {
        if (Math.abs(p.position[c]) - p.size * 0.5 > lim) {
          p.position[c] += p.position[c] > 0 ? -lim*2 : lim*2;
        }
      };

      for (let i = 0; i < NUM; i++) {
        const p = particles[i];
        p.update(dt);
        repeatPos(p, 0, area.x);
        repeatPos(p, 1, area.y);
        repeatPos(p, 2, area.z);
        for (let c=0;c<3;c++) { p.euler[c] %= PI2; if (p.euler[c]<0) p.euler[c]+=PI2; }
        p.zkey = camMat[2]*p.position[0] + camMat[6]*p.position[1] + camMat[10]*p.position[2] + camMat[14];
      }
      particles.sort((a, b) => a.zkey - b.zkey);

      for (let i = 0; i < NUM; i++) {
        const p = particles[i];
        const ip=posOff+i*3, ie=eulerOff+i*3, im=miscOff+i*2;
        dataArray[ip]=p.position[0]; dataArray[ip+1]=p.position[1]; dataArray[ip+2]=p.position[2];
        dataArray[ie]=p.euler[0];    dataArray[ie+1]=p.euler[1];    dataArray[ie+2]=p.euler[2];
        dataArray[im]=p.size;        dataArray[im+1]=1.0;
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      bindProg(gl, flowerProg!);
      gl.uniformMatrix4fv(flowerProg!.uniforms.uProjection, false, projMat);
      gl.uniformMatrix4fv(flowerProg!.uniforms.uModelview, false, camMat);
      gl.uniform3fv(flowerProg!.uniforms.uResolution, resArr);
      gl.uniform3fv(flowerProg!.uniforms.uDOF, v3arr(camDof));
      gl.uniform3fv(flowerProg!.uniforms.uFade, v3arr(fader));
      gl.bindBuffer(gl.ARRAY_BUFFER, flowerBuf);
      gl.bufferData(gl.ARRAY_BUFFER, dataArray, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(flowerProg!.attributes.aPosition, 3, gl.FLOAT, false, 0, posOff  * 4);
      gl.vertexAttribPointer(flowerProg!.attributes.aEuler,    3, gl.FLOAT, false, 0, eulerOff * 4);
      gl.vertexAttribPointer(flowerProg!.attributes.aMisc,     2, gl.FLOAT, false, 0, miscOff  * 4);

      // Draw tiled copies to fill the viewing volume
      for (let i = 1; i < 2; i++) {
        const zpos = i * -2.0;
        const pairs: [number,number][] = [[-1,-1],[-1,1],[1,-1],[1,1]];
        for (const [sx, sy] of pairs) {
          offset[0]=area.x*sx; offset[1]=area.y*sy; offset[2]=area.z*zpos;
          gl.uniform3fv(flowerProg!.uniforms.uOffset, offset);
          gl.drawArrays(gl.POINTS, 0, NUM);
        }
      }
      offset[0]=0; offset[1]=0; offset[2]=0;
      gl.uniform3fv(flowerProg!.uniforms.uOffset, offset);
      gl.drawArrays(gl.POINTS, 0, NUM);

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      unbindProg(gl, flowerProg!);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
    }

    function bindRT(rt: RT, clear: boolean): void {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.frameBuffer);
      gl.viewport(0, 0, rt.width, rt.height);
      if (clear) { gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
    }

    function renderPostProcess(): void {
      gl.disable(gl.DEPTH_TEST);

      // Extract bright areas to half-res RT
      bindRT(wHalfRT0, true);
      applyEffect(gl, fxBright!, halfResArr, mainRT);
      drawEffect(gl, fxBright!);
      unbindProg(gl, fxBright!.program);

      // Two-pass blur
      for (let i = 0; i < 2; i++) {
        const p = 1.5 + i, s = 2.0 + i;
        bindRT(wHalfRT1, true);
        applyEffect(gl, fxBlur!, halfResArr, wHalfRT0);
        gl.uniform4f(fxBlur!.program.uniforms.uBlurDir, p, 0.0, s, 0.0);
        drawEffect(gl, fxBlur!);
        unbindProg(gl, fxBlur!.program);

        bindRT(wHalfRT0, true);
        applyEffect(gl, fxBlur!, halfResArr, wHalfRT1);
        gl.uniform4f(fxBlur!.program.uniforms.uBlurDir, 0.0, p, 0.0, s);
        drawEffect(gl, fxBlur!);
        unbindProg(gl, fxBlur!.program);
      }

      // Final composite to screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, resArr[0], resArr[1]);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      applyEffect(gl, fxFinal!, resArr, mainRT);
      gl.uniform1i(fxFinal!.program.uniforms.uBloom, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, wHalfRT0.texture);
      drawEffect(gl, fxFinal!);
      unbindProg(gl, fxFinal!.program);

      gl.enable(gl.DEPTH_TEST);
    }

    function animate(): void {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      const dt = Math.min((now - prevTime) / 1000, 0.05); // cap delta
      prevTime = now;

      m44lookAt(camMat, camPos, camLook, camUp);

      // Render scene to mainRT
      gl.enable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mainRT.frameBuffer);
      gl.viewport(0, 0, mainRT.width, mainRT.height);
      gl.clearColor(0.005, 0, 0.05, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Background
      gl.disable(gl.DEPTH_TEST);
      applyEffect(gl, fxBg!, resArr, null);
      gl.uniform2f(fxBg!.program.uniforms.uTimes, elapsed, dt);
      drawEffect(gl, fxBg!);
      unbindProg(gl, fxBg!.program);
      gl.enable(gl.DEPTH_TEST);

      renderFlowers(dt);
      renderPostProcess();

      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);

    // ── Resize ──────────────────────────────────────────────────────────────
    const onResize = () => {
      setViewports(mount.clientWidth, mount.clientHeight);
      initScene();
    };
    window.addEventListener('resize', onResize);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      [mainRT, wFullRT0, wFullRT1, wHalfRT0, wHalfRT1].forEach(rt => rt && rmRT(gl!, rt));
      gl.deleteBuffer(flowerBuf);
      if (fxBg)     gl.deleteBuffer(fxBg.buffer);
      if (fxBright) gl.deleteBuffer(fxBright.buffer);
      if (fxBlur)   gl.deleteBuffer(fxBlur.buffer);
      if (fxFinal)  gl.deleteBuffer(fxFinal.buffer);
      [flowerProg, fxBg?.program, fxBright?.program, fxBlur?.program, fxFinal?.program]
        .forEach(p => p && gl.deleteProgram(p.prog));
      if (mount.contains(canvas)) mount.removeChild(canvas);
    };
  }, []);

  return <div ref={mountRef} className={`w-full h-full ${className ?? ''}`} />;
});
