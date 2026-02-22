import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec4 vPosition;
void main() {
  gl_Position = vPosition;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
  
uniform vec4 mouse;
uniform vec2 resolution;
uniform float time;

#define T time
#define M mouse
#define R resolution

#define PI  3.14159265359
#define PI2 6.28318530718

#define MAX_DIST    65.
#define MIN_DIST    .0005

mat2 rot(float a) { return mat2(cos(a),sin(a),-sin(a),cos(a)); }

float hash21(vec2 p) {
    return fract(sin(dot(p,vec2(23.86,48.32)))*4374.432); 
}

float noise (in vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);
    float a = hash21(i);
    float b = hash21(i + vec2(1., 0.));
    float c = hash21(i + vec2(0., 1.));
    float d = hash21(i + vec2(1., 1.));
    vec2 u = f;
    return mix(a, b, u.x) + (c - a)* u.y * (1. - u.x) + (d - b)* u.x * u.y;
}

float fbm( vec2 p, float freq ) {
  float h = -1.5;
  float w = 2.50;
  float m = 0.25;
  for (float i = 0.; i < freq; i++) {
    h += w * noise((p * m));
    w *= 0.5; m *= 2.0;
  }
  return h;
}

float gaz( vec3 p, float s) {
    float e = abs(p.x+p.y)+abs(p.y+p.z)+abs(p.z+p.x)+abs(p.x-p.y)+abs(p.y-p.z)+abs(p.z-p.x)-s;
    return e/3.5;
}

float zag(vec3 p, float s) {
    p = abs(p)-s;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.yz = p.zy;
    if (p.x < p.y) p.xy = p.yx;
    return dot(p,normalize(vec3(s*.42,s,0)));
}

float box(vec3 p, vec3 b ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

const float angle = 2.*PI/6.;
const float hfang = angle*.5;
void mpolar(inout vec2 p) {
    float a = atan(p.y, p.x) + hfang;
    float c = floor(a/angle);
    a = mod(a,angle) - hfang;
    p = vec2(cos(a), sin(a))*length(p);
} 

vec3 hitPoint,hit;
vec2 gid,sid;
float mvt = 0.,snh,gnh;
mat2 turn,wts;

const float sz = .325;
const float hf = sz*.5;
const float db = sz *2.;
const float detail = 4.;
const float pwr = 1.75;

vec2 map(vec3 p) {
  vec2 res = vec2(1e5,0.);
  p.y+=4.;
  p.x+=mvt;
  float ter = fbm(p.xz*sz,detail)*pwr;
  float d2 = p.y - ter;
  
  if(d2<res.x) {
     res = vec2(d2,2.);
     hit=p;
     gnh=ter;
  }

  vec2 id = floor(p.xz*sz) + .5;    
  vec2 r = p.xz - id/sz;
  vec3 q = vec3(r.x,p.y,r.y);
  float hs = hash21(id);
  float xtr = fbm(id,detail)*pwr;
  vec3 qq=q-vec3(0,xtr+.2,0);

  mat2 htn = rot(-hs*PI2);
  qq.yz*= htn;
  qq.xz*= htn;

  float df = gaz(qq,4.5*hs*hs);
  if(df<res.x && hs>.5 && xtr>1.75) {
      res=vec2(df,3.);
      hit=p;
      gnh=xtr;
      gid=id;
  }
  
  float zz = 1.25;
  vec2 fid = floor(p.xz*zz) + .5;    
  vec2 fr = p.xz - fid/zz;
  vec3 fq = vec3(fr.x,p.y,fr.y);
  
  hs = hash21(fid);
  qq=fq-vec3(0,ter+.001,0);

  mpolar(qq.xz);      
  float adjust = sin(qq.x*12.);
  float flwr= box(qq,vec3(.3,smoothstep(.01,.35,.035*adjust),.035*adjust));
  if(flwr<res.x && hs<.1 ) {
      res=vec2(flwr,4.);
      hit=qq;
      gnh=ter;
      gid=fid;
  }

  float cells = 8.;
  vec3 qz = p-vec3(mvt,7.25,0);
  qz.xz*=turn;
  float a = atan(qz.z, qz.x);
  float ia = floor(a/6.2831853*cells);
  ia = (ia + .5)/cells*6.2831853;

  float ws = -mod(ia,.0);
  float cy = sin( ws*4. + (T * .25) * PI) * 1.5;
  qz.y +=cy;

  qz.xz *= rot(ia);
  qz.x -= 6.5;
 
  wts = rot(ws+T);
  qz.zy*=wts;
  qz.xz*=wts;

  float dx = zag(qz,.25);
  if(dx<res.x) {
      res=vec2(dx,5.);
      hit=qz;
      gnh=ws;
  }
  
  return res;
}

vec3 normal(vec3 p, float t) {
  float e = MIN_DIST*t;
  vec2 h = vec2(1.0,-1.0)*0.5773;
  return normalize( 
      h.xyy*map( p + h.xyy*e ).x + 
      h.yyx*map( p + h.yyx*e ).x + 
      h.yxy*map( p + h.yxy*e ).x + 
      h.xxx*map( p + h.xxx*e ).x );
}

vec3 vor3D(in vec3 p, in vec3 n ){
  n = max(abs(n), MIN_DIST);
  n /= dot(n, vec3(1));

  float tx = hash21(floor(p.xy));
  float ty = hash21(floor(p.zx));
  float tz = hash21(floor(p.yz));
  return vec3(tx*tx, ty*ty, tz*tz)*n;
}

vec3 glintz( vec3 lcol, vec3 pos, vec3 n, vec3 rd, vec3 lpos, float fresnel) {
  vec3 mate = vec3(0);
  vec3 h = normalize(lpos-rd);
  float nh = abs(dot(n,h)), nl = dot(n,lpos);
  vec3 light = lcol*max(.0,nl)*1.5;
  vec3 coord = pos*1.5, coord2 = coord;

  vec3 ww = fwidth(pos);
  vec3 glints=vec3(0);
  vec3 tcoord;
  float pw,q,anisotropy;
 
  for(int i = 0; i < 2;i++) {

      if( i==0 ) {
          anisotropy=.55;
          pw=R.x*.20;
          tcoord=coord;
      } else {
          anisotropy=.62;
          pw=R.x*.10;
          tcoord=coord2;
      }
      
      vec3 aniso = vec3(vor3D(tcoord.zyx*pw,n).yy, vor3D(tcoord.xyz*vec3(pw,-pw,-pw),n).y)*1.0-.5;
      if(i==0) {
          aniso -= n*dot(aniso,n);
          aniso /= min(1.,length(aniso));
      }

      float ah = abs(dot(h,aniso));
 
      if( i==0 ) {
          q = exp2((1.15-anisotropy)*2.5);
          nh = pow( nh, q*4.);
          nh *= pow( 1.-ah*anisotropy, 10.);
      } else {
          q = exp2((.1-anisotropy)*3.5);
          nh = pow( nh, q*.4);
          nh *= pow( 1.-ah*anisotropy, 150.);
      }     

      glints += (lcol*nh*exp2(((i==0?1.25:1.)-anisotropy)*1.3))*smoothstep(.0,.5,nl);
  }
  return  mix(light*vec3(0.3), vec3(.05), fresnel) + glints + lcol * .3;
}

vec3 ACESFilm(in vec3 x) { return clamp((x*(.6275*x+.015))/(x*(.6075*x+.295)+.14),0.,1.); }

vec3 getSky(vec3 ro, vec3 rd, vec3 ld, float ison) { 
  rd.y+=.2;
  rd.z *= .95 - length(rd.xy)*.5;
  rd = normalize(rd);

  vec3 Rayleigh = vec3(1), Mie = vec3(1); 
  vec3 betaR = vec3(5.8e-2, 1.35e-1, 3.31e-1), betaM = vec3(4e-2); 
  float zAng = max(2e-6, rd.y);
  vec3 extinction = exp(-(betaR*1. + betaM*1.)/zAng);

  vec3 col = 2.*(1. - extinction);
  float t = (1e5 - ro.y - .15)/(rd.y + .45);
  vec2 uv = (ro + t*rd).xz;

  if(t>0.&&ison>0.) {
    col = mix(col, vec3(3), smoothstep(1.,.475,  fbm(5.*uv/1e5,5.))*
                            smoothstep(.15, .85, rd.y*.5 + .5)*.4);  
  }

  return clamp(ACESFilm(col), 0., 1.);
} 

vec3 sky = vec3(0);

vec3 hue(float a, float b, float c) {
  return b+c*cos(PI2*a*(vec3(1.25,.5,.25)*vec3(.99,.97,.96))); 
}

vec4 render(inout vec3 ro, inout vec3 rd, inout vec3 ref, bool last, inout float d) {

  vec3 sky = getSky(ro,rd,vec3(.0,.02,1.01),1.);
  vec3 C = vec3(0);

  float  m = 0.;
  vec3 p = ro;
  for (int i = 0; i<128;i++) {
   
    p = ro + rd * d;
    vec2 ray = map(p);
    if(abs(ray.x)<d*MIN_DIST || d>MAX_DIST)break;
    d += i<32 ? ray.x*.25 : ray.x*.75; 
    m = ray.y;
  }
  
  hitPoint=hit;
  sid=gid;
  snh=gnh;
  float alpha = 0.;
  
  if(d<MAX_DIST){
    
    vec3 n = normal(p, d);
    
    vec3 lpos = vec3(-11.,15,18.);
    vec3 l = normalize(lpos-p);    
    float diff = clamp(dot(n,l),0.,1.);
    float shdw = 1., t = .01;
    for(int i=0; i<24; i++){
        float h = map(p + l*t).x;
        if( h<MIN_DIST ) {shdw = 0.; break;}
        shdw = min(shdw, 14.*h/t);
        t += h * .8;
        if( shdw<MIN_DIST || t>32. ) break;
    }
    diff = mix(diff,diff*shdw,.65);

    float fresnel = pow(1.0 + dot(n,rd), 2.0);
    fresnel = mix( 0.0, 0.95, fresnel );
    
    vec3 view = normalize(p - ro);
    vec3 ret = reflect(normalize(lpos), n);
    float spec = 0.5 * pow(max(dot(view, ret), 0.), 24.);

    ref=vec3(.0);
    vec3 h = vec3(.5);
    
    if(m==2.) {
        vec3 c = mix(vec3(0.647,0.573,0.192),vec3(0.082,0.459,0.145),clamp(.1+snh*.5,0.,1.));
        h = glintz(c, hitPoint*.2, n, rd, l, fresnel);
    }
    if(m==3.) {
        h = clamp(hue((snh+fresnel)*3.25,.80,.15)*.85,vec3(.1),vec3(1.));
        ref = h-fresnel;
    }
    if(m==4.) {    
        h = vec3(0.329,0.580,0.020);
        ref = h-fresnel;
    }
    if(m==5.) {    
        h = vec3(0.286+fresnel,0.576+fresnel,0.953);
        ref = h-fresnel;
    }
    C += h * diff+spec;
    C = mix(vec3(0.392,0.502,0.565),C,  exp(-.000015*d*d*d));

    ro = p+n*.005;
    rd = reflect(rd,n);
     
  } else {
    C = sky;
  }
  
  C=clamp(C,vec3(.03),vec3(1.));
  return vec4(C,alpha);
}

void main() {
  mvt= 280.;
  turn = rot(T*.2);
  vec2 F = gl_FragCoord.xy;
  vec2 uv = (2.*F.xy-R.xy)/max(R.x,R.y);
  float sf = .5*sin(T*.1);
  vec3 ro = vec3(0,1.65,13.+sf);
  vec3 rd = normalize(vec3(uv,-1));

  float x = M.xy == vec2(0) ? .0 : .07+(M.y/R.y * .0625 - .03125) * PI;
  float y = M.xy == vec2(0) ? .0 : -(M.x/R.x * .5 - .25) * PI;
  float sx = .3*cos(T*.1);
  mat2 rx = rot(x), ry=rot(y+sx);
  ro.yz *= rx; ro.xz *= ry;
  rd.yz *= rx; rd.xz *= ry;
  
  sky = getSky(ro,rd,vec3(.0,.02,1.01),1.);
  vec3 C = vec3(0);
  vec3 ref=vec3(0);
  vec3 fill=vec3(1.);
  
  float d =0.;
  float a =0.;
  for(float i=0.; i<2.; i++) {
      vec4 pass = render(ro, rd, ref, i==2.-1., d);
      C += pass.rgb*fill;
      fill*=ref;
      if(i==0.)a=d;
  }

  C = mix(sky,C, exp(-.000015*a*a*a));
  C = pow(C, vec3(.4545));
  C = clamp(C,vec3(.03),vec3(1.));
  fragColor = vec4(C,1.0);
}
`;

export const DepthCardScene = memo(function DepthCardScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0, dragging: false });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!gl) {
      console.warn('[DepthCardScene] WebGL2 not available. Scene disabled.');
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -1,  1, 0, 1,
      -1, -1, 0, 1,
       1, -1, 0, 1,
       1,  1, 0, 1,
    ]);
    geometry.setAttribute('vPosition', new THREE.BufferAttribute(vertices, 4));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);

    const uniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      mouse: { value: new THREE.Vector4(0, 0, 0, 0) },
    };

    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
    });
    material.onBeforeCompile = (shader) => {
      if (shader?.diagnostics?.vertexErrors?.length) {
        console.warn('[DepthCardScene] Vertex shader errors:', shader.diagnostics.vertexErrors);
      }
      if (shader?.diagnostics?.fragmentErrors?.length) {
        console.warn('[DepthCardScene] Fragment shader errors:', shader.diagnostics.fragmentErrors);
      }
    };

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height, false);
      uniforms.resolution.value.set(width, height);
    };
    resize();

    const handlePointerDown = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.dragging = true;
      mouseRef.current.x = event.clientX - rect.left;
      mouseRef.current.y = rect.height - (event.clientY - rect.top);
    };

    const handlePointerUp = () => {
      mouseRef.current.dragging = false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!mouseRef.current.dragging) return;
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = event.clientX - rect.left;
      mouseRef.current.y = rect.height - (event.clientY - rect.top);
    };

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointermove', handlePointerMove);

    let animationFrame = 0;
    const start = performance.now();
    const render = (now: number) => {
      const elapsed = (now - start) / 1000;
      uniforms.time.value = elapsed;

      const factor = 0.15;
      mouseRef.current.tx = mouseRef.current.tx + (mouseRef.current.x - mouseRef.current.tx) * factor;
      mouseRef.current.ty = mouseRef.current.ty + (mouseRef.current.y - mouseRef.current.ty) * factor;
      uniforms.mouse.value.set(mouseRef.current.tx, mouseRef.current.ty, 0, 0);

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 rounded-[18px] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
});
