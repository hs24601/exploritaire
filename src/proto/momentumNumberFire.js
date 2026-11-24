// Adapted from the user-supplied Omni Flames lab (2026-10-23).
// Its simplex shell, surface sampling, curl flow and flame-to-ash lifecycle
// are retained; the torus demo is replaced by a bounded, centered numeral mesh.
import * as THREE from 'three';
import {MeshSurfaceSampler} from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import {FontLoader} from 'three/examples/jsm/loaders/FontLoader.js';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry.js';
import {TessellateModifier} from 'three/examples/jsm/modifiers/TessellateModifier.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
const font=new FontLoader().parse(fontData);
export function createMomentumNumberFire(scene,camera,viewport,maskScene){
    /* ============== GLSL noise (shell 용) ============== */
    const NOISE_GLSL = /* glsl */`
    vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
    vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
    vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy));
      vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);
      vec3 l=1.0-g;
      vec3 i1=min(g.xyz,l.zxy);
      vec3 i2=max(g.xyz,l.zxy);
      vec3 x1v=x0-i1+1.0*C.xxx;
      vec3 x2v=x0-i2+2.0*C.xxx;
      vec3 x3v=x0-1.0+3.0*C.xxx;
      i=mod289(i);
      vec4 p=permute( permute( permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0) );
      float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z), y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy, y=y_*ns.x+ns.yyyy;
      vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy);
      vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0, s1=floor(b1)*2.0+1.0, sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy, a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy, h.x);
      vec3 p1=vec3(a0.zw, h.y);
      vec3 p2=vec3(a1.xy, h.z);
      vec3 p3=vec3(a1.zw, h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1v,x1v),dot(x2v,x2v),dot(x3v,x3v)),0.0);
      m=m*m;
      return 42.0*dot(m*m, vec4(dot(p0,x0),dot(p1,x1v),dot(p2,x2v),dot(p3,x3v)));
    }
    float fbm(vec3 p){ float f=0.0,a=0.5; for(int i=0;i<5;i++){ f+=a*snoise(p); p*=2.02; a*=0.5; } return f; }`;

    /* ============== Bounds helper ============== */
    function computeWorldYBounds(mesh){
      mesh.updateWorldMatrix(true,true);
      const g = mesh.geometry; if(!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox;
      const pts = [
        new THREE.Vector3(bb.min.x,bb.min.y,bb.min.z),
        new THREE.Vector3(bb.min.x,bb.min.y,bb.max.z),
        new THREE.Vector3(bb.min.x,bb.max.y,bb.min.z),
        new THREE.Vector3(bb.min.x,bb.max.y,bb.max.z),
        new THREE.Vector3(bb.max.x,bb.min.y,bb.min.z),
        new THREE.Vector3(bb.max.x,bb.min.y,bb.max.z),
        new THREE.Vector3(bb.max.x,bb.max.y,bb.min.z),
        new THREE.Vector3(bb.max.x,bb.max.y,bb.max.z),
      ];
      let ymin=Infinity,ymax=-Infinity;
      for(const p of pts){ p.applyMatrix4(mesh.matrixWorld); ymin=Math.min(ymin,p.y); ymax=Math.max(ymax,p.y); }
      return { ymin, ymax, height: Math.max(0.0001, ymax - ymin) };
    }

    /* ============== Outward overlay shell (전방향 발광) ============== */
    const SHELL_VERT = /* glsl */`
    precision highp float;
    uniform float uTime, uNoiseScale, uNoiseSpeed;
    uniform float uShellOffset, uShellAmp, uShellStretch, uFarMul;
    uniform float uCoverage, uLift;
    uniform float uCurlScale, uMixCurl;
    uniform vec3  uWind;
    varying vec3 vWPos; varying vec3 vWN; varying float vExtrude;
    ${NOISE_GLSL}
    vec3 curlNoise(vec3 p, float eps){
      vec3 ex=vec3(eps,0,0), ey=vec3(0,eps,0), ez=vec3(0,0,eps);
      vec3 Fpx=vec3(snoise(p+ex),snoise(p+ex+vec3(17.0)),snoise(p+ex-vec3(13.0)));
      vec3 Fnx=vec3(snoise(p-ex),snoise(p-ex+vec3(17.0)),snoise(p-ex-vec3(13.0)));
      vec3 Fpy=vec3(snoise(p+ey),snoise(p+ey+vec3(17.0)),snoise(p+ey-vec3(13.0)));
      vec3 Fny=vec3(snoise(p-ey),snoise(p-ey+vec3(17.0)),snoise(p-ey-vec3(13.0)));
      vec3 Fpz=vec3(snoise(p+ez),snoise(p+ez+vec3(17.0)),snoise(p+ez-vec3(13.0)));
      vec3 Fnz=vec3(snoise(p-ez),snoise(p-ez+vec3(17.0)),snoise(p-ez-vec3(13.0)));
      vec3 dFx=(Fpx-Fnx)/(2.0*eps), dFy=(Fpy-Fny)/(2.0*eps), dFz=(Fpz-Fnz)/(2.0*eps);
      return vec3(dFz.y-dFy.z, dFx.z-dFz.x, dFy.x-dFx.y);
    }
    void main(){
      vec3 wpos = (modelMatrix*vec4(position,1.0)).xyz;
      vec3 wn   = normalize(mat3(modelMatrix)*normal);
      float flow = uTime * uNoiseSpeed;
      float n1   = fbm(wpos*uNoiseScale + vec3(0.0,flow,0.0));
      float n2   = fbm(wpos*(uNoiseScale*2.1) + vec3(3.1,flow*1.6,7.7));
      vec3 curl  = curlNoise(wpos*uCurlScale + vec3(0.0,flow,0.0), 0.8);
      vec3 dir   = normalize(wn*(1.0-uMixCurl) + normalize(curl + uWind)*uMixCurl + 1e-5);
      float extrude = (uShellOffset + (uShellAmp*(0.5+0.5*n1) + uShellStretch*max(n2,0.0))) * max(0.0,uCoverage) * uFarMul;
      vec3 displaced = position + dir * extrude;
      displaced.y += uLift * uCoverage;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced,1.0);
      vWPos = (modelMatrix*vec4(displaced,1.0)).xyz; vWN = wn; vExtrude = extrude;
    }`;
    const SHELL_FRAG = /* glsl */`
    precision highp float;
    uniform float uTime, uNoiseScale, uNoiseSpeed, uCoverage, uFadeFalloff, uAlphaMul, uFresnelPow, uGlowMul;
    uniform vec3  uColorHot, uColorMid, uColorCool, uEdgeColor;
    varying vec3 vWPos; varying vec3 vWN; varying float vExtrude;
    ${NOISE_GLSL}
    vec3 ramp(float t){ t=clamp(t,0.0,1.0); return mix(uColorCool, mix(uColorMid,uColorHot,t*t), t); }
    void main(){
      float flow = uTime * uNoiseSpeed;
      float f = fbm(vWPos*uNoiseScale + vec3(0.0,flow,0.0));
      float d = fbm(vWPos*(uNoiseScale*2.0) + vec3(11.0,flow*1.5,5.0));
      float heat = clamp(0.65*f + 0.35*d, 0.0, 1.0);
      vec3 col = ramp(heat);
      vec3 V = normalize(cameraPosition - vWPos);
      float fres = pow(1.0 - max(0.0, dot(normalize(vWN), V)), uFresnelPow);
      col += uEdgeColor * fres * uGlowMul;
      float fade = exp(-max(0.0, vExtrude) / max(0.0001, uFadeFalloff));
      float alpha = uCoverage * fade * uAlphaMul;
      gl_FragColor = vec4(col, alpha);
      if(gl_FragColor.a < 0.01) discard;
    }`;
    function makeShellMaterial(){
      const mat = new THREE.ShaderMaterial({
        vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG,
        transparent:true, depthWrite:false, depthTest:true,
        side:THREE.DoubleSide, blending:THREE.AdditiveBlending,
        polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2
      });
      mat.uniforms = {
        uTime:{value:0}, uNoiseScale:{value:0.7}, uNoiseSpeed:{value:0.9},
        uCurlScale:{value:0.5}, uMixCurl:{value:0.7},
        uShellOffset:{value:0.015}, uShellAmp:{value:0.11}, uShellStretch:{value:0.22}, uFarMul:{value:1.8},
        uCoverage:{value:0.9}, uLift:{value:0.02}, uWind:{value:new THREE.Vector3(0,0,0)},
        uFadeFalloff:{value:0.24}, uAlphaMul:{value:1.15}, uFresnelPow:{value:2.0}, uGlowMul:{value:1.2},
        uColorHot:{value:new THREE.Color(1.0,0.96,0.88)}, uColorMid:{value:new THREE.Color(1.0,0.58,0.12)},
        uColorCool:{value:new THREE.Color(0.55,0.12,0.06)}, uEdgeColor:{value:new THREE.Color(1.0,0.85,0.35)}
      };
      return mat;
    }

    /* ============== JS Perlin + Curl (파티클용) ============== */
    // 간결한 Perlin 3D (JS)
    const _GRADS = [
      [1,1,0], [-1,1,0], [1,-1,0], [-1,-1,0],
      [1,0,1], [-1,0,1], [1,0,-1], [-1,0,-1],
      [0,1,1], [0,-1,1], [0,1,-1], [0,-1,-1]
    ];
    function _hash(x,y,z,seed=0){
      let h = (x*374761393 + y*668265263 + z*2147483647 + seed*374761)>>>0;
      h = (h ^ (h>>13))>>>0; h = (h*1274126177)>>>0; return h>>>0;
    }
    function _grad(ix,iy,iz,x,y,z,seed){
      const h = _hash(ix,iy,iz,seed)%12;
      const g = _GRADS[h]; return g[0]*(x-ix)+g[1]*(y-iy)+g[2]*(z-iz);
    }
    function _fade(t){ return t*t*t*(t*(t*6-15)+10); }
    function perlin3(x,y,z,seed=0){
      const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
      const xf = x-X, yf=y-Y, zf=z-Z;
      const u=_fade(xf), v=_fade(yf), w=_fade(zf);
      function lerp(a,b,t){ return a+(b-a)*t; }
      const n000=_grad(X,Y,Z,x,y,z,seed);
      const n100=_grad(X+1,Y,Z,x,y,z,seed);
      const n010=_grad(X,Y+1,Z,x,y,z,seed);
      const n110=_grad(X+1,Y+1,Z,x,y,z,seed);
      const n001=_grad(X,Y,Z+1,x,y,z,seed);
      const n101=_grad(X+1,Y,Z+1,x,y,z,seed);
      const n011=_grad(X,Y+1,Z+1,x,y,z,seed);
      const n111=_grad(X+1,Y+1,Z+1,x,y,z,seed);
      const x00=lerp(n000,n100,u), x10=lerp(n010,n110,u);
      const x01=lerp(n001,n101,u), x11=lerp(n011,n111,u);
      const y0=lerp(x00,x10,v), y1=lerp(x01,x11,v);
      return lerp(y0,y1,w); // 약 -1..1
    }
    // 벡터장 F(p,t) & curl ∇×F
    function fieldVec(p, t, scale=0.6){
      const o1=17.2, o2=31.7, o3=9.9, ts=0.35;
      const x=p.x*scale, y=p.y*scale, z=p.z*scale;
      return new THREE.Vector3(
        perlin3(x+o1, y+ts*t, z-o3, 11),
        perlin3(x-o2, y+o3, z+ts*t, 23),
        perlin3(x+ts*t, y+o1, z+o2, 37)
      );
    }
    function curlAt(p, t, scale=0.6, eps=0.5){
      const ex=new THREE.Vector3(eps,0,0), ey=new THREE.Vector3(0,eps,0), ez=new THREE.Vector3(0,0,eps);
      const Fpx=fieldVec(p.clone().add(ex), t, scale), Fnx=fieldVec(p.clone().sub(ex), t, scale);
      const Fpy=fieldVec(p.clone().add(ey), t, scale), Fny=fieldVec(p.clone().sub(ey), t, scale);
      const Fpz=fieldVec(p.clone().add(ez), t, scale), Fnz=fieldVec(p.clone().sub(ez), t, scale);
      const dFx=Fpx.sub(Fnx).multiplyScalar(1/(2*eps));
      const dFy=Fpy.sub(Fny).multiplyScalar(1/(2*eps));
      const dFz=Fpz.sub(Fnz).multiplyScalar(1/(2*eps));
      return new THREE.Vector3(
        dFz.y - dFy.z,
        dFx.z - dFz.x,
        dFy.x - dFx.y
      );
    }
    // 빠른 난수 벡터 (seed,time) → 작은 지터
    function randVec(seed, t){
      const s = Math.sin(seed*12.9898 + t*78.233)*43758.5453;
      const r = s - Math.floor(s);
      const a = r * Math.PI*2.0;
      return new THREE.Vector3(Math.cos(a), Math.sin(a*0.7), Math.sin(a*1.3)).normalize();
    }

    /* ============== Streaks (Instanced Quads, 속도정렬 + ash) ============== */
    function createFlameStreaks(surfaceMesh, count=1600){
      const base = new THREE.InstancedBufferGeometry();
      const quad = new THREE.PlaneGeometry(1,1).toNonIndexed();
      base.setAttribute('position', quad.getAttribute('position'));
      base.setAttribute('uv', quad.getAttribute('uv'));
      base.setIndex(quad.index);
      const aPos = new THREE.InstancedBufferAttribute(new Float32Array(count*3), 3);
      const aVel = new THREE.InstancedBufferAttribute(new Float32Array(count*3), 3);
      const aAge = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      const aLife= new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      const aSeed= new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
      base.setAttribute('aPos', aPos);
      base.setAttribute('aVel', aVel);
      base.setAttribute('aAge', aAge);
      base.setAttribute('aLife', aLife);
      base.setAttribute('aSeed', aSeed);

      const mat = new THREE.RawShaderMaterial({
        transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending,
        uniforms:{
          uTime:{value:0},
          uViewport:{value:new THREE.Vector2(viewport.width, viewport.height)},
          uFov:{value:THREE.MathUtils.degToRad(camera.fov)},
          // 기본 길이/두께
          uWidthPx:{value:9.0*viewport.width/320}, uLenPx:{value:38.0*viewport.height/320},
          // ash 단계
          uAshStart:{value:0.65},
          uAshColor:{value:new THREE.Color(0.45,0.45,0.45)},
          // 컬러 램프
          uColorHot:{value:new THREE.Color(1.0,0.95,0.88)},
          uColorMid:{value:new THREE.Color(1.0,0.62,0.18)},
          uColorCool:{value:new THREE.Color(0.58,0.16,0.08)},
        },
        vertexShader: /* glsl */`
        precision highp float;
        attribute vec3 position; attribute vec2 uv;
        attribute vec3 aPos; attribute vec3 aVel;
        attribute float aAge; attribute float aLife; attribute float aSeed;
        uniform mat4 projectionMatrix, viewMatrix;
        uniform vec2 uViewport;
        uniform float uFov, uWidthPx, uLenPx;
        uniform float uTime, uAshStart;
        varying vec2 vUv; varying float vT; varying float vAshMix; varying float vSeed;
        // 속도 방향 정렬 빌보드
        vec3 orthonormal(vec3 v){
          vec3 a = abs(v.z) < 0.999 ? vec3(0.0,0.0,1.0) : vec3(0.0,1.0,0.0);
          vec3 s = normalize(cross(a, v));
          return s;
        }
        void main(){
          vec3 Pv = (viewMatrix * vec4(aPos,1.0)).xyz; // 월드→뷰
          vec3 Vv = (viewMatrix * vec4(aVel,0.0)).xyz;
          Vv = normalize(Vv + vec3(1e-6));            // 속도 단위벡터
          // Project flow onto the camera plane so streaks face the viewer.
          Vv = normalize(vec3(Vv.xy, 0.0) + vec3(1e-6,0.0,0.0));
          vec3 side = vec3(-Vv.y, Vv.x, 0.0);                // 폭 방향
          // 수명 비율
          float T = clamp(aAge/aLife, 0.0, 1.0);
          vT = T;
          // ash로 전환 비율
          float ashMix = smoothstep(uAshStart, 1.0, T);
          vAshMix = ashMix;
          // 수명에 따라 폭/길이 축소
          float pixelToView = 2.0 * tan(uFov*0.5) * abs(Pv.z) / uViewport.y;
          float width = uWidthPx * (1.0 - 0.45*T) * (1.0 - 0.6*ashMix);
          float length = uLenPx * (1.0 - 0.35*T) * (1.0 - 0.7*ashMix) + 3.0*ashMix;
          float halfW = 0.5 * width * pixelToView;
          float halfL = 0.5 * length * pixelToView;

          vec2 c = position.xy; // -0.5..0.5
          vec3 offsetV = side * (c.x * 2.0 * halfW) + Vv * (c.y * 2.0 * halfL);
          vec4 Pv4 = vec4(Pv + offsetV, 1.0);
          gl_Position = projectionMatrix * Pv4;

          vUv = uv; vSeed = aSeed;
        }`,
        fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3 uColorHot, uColorMid, uColorCool, uAshColor;
        varying vec2 vUv; varying float vT; varying float vAshMix; varying float vSeed;
        // 간단 마스크 + 가장 뜨거운 헤드 강조
        float hash(float n){ return fract(sin(n)*43758.5453); }
        vec3 ramp(float t){ t=clamp(t,0.0,1.0); return mix(uColorCool, mix(uColorMid, uColorHot, t*t), t); }
        void main(){
          vec2 q = vUv*2.0 - 1.0;
          // Curled, tapered flame tongues rather than rigid luminous needles.
          float taper = mix(.9,.05,smoothstep(-1.0,1.0,q.y));
          float curl = sin(q.y*3.2 + vSeed*6.28 + vT*2.0)*.24*(q.y+1.0)*.5;
          float core = abs(q.x-curl)/max(.04,taper);
          float mask = (1.0-smoothstep(.25,1.0,core))*(1.0-smoothstep(.45,1.0,abs(q.y)));
          float head = smoothstep(-0.4, 1.0, q.y*1.6);
          vec3 fireCol = ramp(0.55 + 0.45*head);
          // ash 컬러로 점진적 전환 + 거친 그레인
          float g = hash(vSeed*97.13 + q.x*31.7 + q.y*11.3 + vT*13.7);
          vec3 col = mix(fireCol, uAshColor*(0.9+0.2*g), vAshMix);
          float alpha = mask * (1.0 - pow(vT, 1.4)) * (1.0 - 0.25*vAshMix);
          gl_FragColor = vec4(col, alpha);
          if(gl_FragColor.a < 0.02) discard;
        }`
      });

      const mesh = new THREE.Mesh(base, mat); scene.add(mesh);

      const sampler = new MeshSurfaceSampler(surfaceMesh).build();
      const P = aPos.array, V = aVel.array, A = aAge.array, L = aLife.array, S = aSeed.array;
      const tmpP = new THREE.Vector3(), tmpN = new THREE.Vector3();

      // 파티클 필드/업데이트 파라미터
      const params = {
        outBias: 0.55,     // 표면 노멀 가중치(밖으로 밀어내기)
        align: 0.35,        // 필드 벡터 정렬 강도
        swirl: 0.4,        // 회전 성분 (V×F)
        jitterAmp: 0.15,    // 미세 지터
        buoyancy: 0.15,    // 약간의 상승 (너무 크면 위로만 감)
        fieldScale: 0.6,
      };

      function initialDir(pos, normal, t){
        const F = curlAt(pos, t, params.fieldScale);
        const d = new THREE.Vector3().copy(normal).multiplyScalar(params.outBias)
            .add(F.normalize().multiplyScalar(1.0-params.outBias));
        if (d.lengthSq() < 1e-6) d.copy(normal);
        return d.normalize();
      }

      function respawn(i, t=0){
        sampler.sample(tmpP, tmpN); surfaceMesh.localToWorld(tmpP);
        tmpN.transformDirection(surfaceMesh.matrixWorld).normalize();
        const idx=i*3;
        P[idx]=tmpP.x; P[idx+1]=tmpP.y; P[idx+2]=tmpP.z;
        const d = initialDir(tmpP, tmpN, t);
        const sp = 0.45 + Math.random()*0.5;
        V[idx]=d.x*sp; V[idx+1]=d.y*sp; V[idx+2]=d.z*sp;
        L[i]=0.4 + Math.random()*0.65;
        A[i]=Math.random()*0.12; // 약간 랜덤 시작
        S[i]=Math.random()*1000.0;
      }
      for(let i=0;i<count;i++) respawn(i, 0);

      base.attributes.aPos.needsUpdate =
      base.attributes.aVel.needsUpdate =
      base.attributes.aAge.needsUpdate =
      base.attributes.aLife.needsUpdate = true;

      function update(dt, t){
        const drag = 0.985;
        for(let i=0;i<count;i++){
          const idx=i*3;
          A[i]+=dt;
          if(A[i]>=L[i]){ respawn(i, t); continue; }

          // 현재 위치
          const pos = new THREE.Vector3(P[idx],P[idx+1],P[idx+2]);

          // 1) 필드 벡터 (curl) & 정렬
          const F = curlAt(pos, t, params.fieldScale);
          // 2) 회전(스월) 성분: V × F
          const Vv = new THREE.Vector3(V[idx],V[idx+1],V[idx+2]);
          const swirl = new THREE.Vector3().copy(Vv).cross(F).multiplyScalar(params.swirl*dt);
          // 3) 지터 (브라운 운동 성격)
          const j = randVec(S[i], t*1.7).multiplyScalar(params.jitterAmp*dt);
          // 4) 부력(약간만)
          const buoy = new THREE.Vector3(0, params.buoyancy*dt, 0);

          // 속도 통합
          const align = F.multiplyScalar(params.align*dt);
          Vv.add(align).add(swirl).add(j).add(buoy);
          // 감쇄
          Vv.multiplyScalar(drag);

          // 위치 업데이트
          pos.addScaledVector(Vv, dt);

          // write-back
          V[idx]=Vv.x; V[idx+1]=Vv.y; V[idx+2]=Vv.z;
          P[idx]=pos.x; P[idx+1]=pos.y; P[idx+2]=pos.z;
        }
        aPos.needsUpdate = aVel.needsUpdate = aAge.needsUpdate = true;
      }

      function onResize(){
        mat.uniforms.uViewport.value.set(viewport.width, viewport.height);
        mat.uniforms.uFov.value = THREE.MathUtils.degToRad(camera.fov);
        mat.uniforms.uWidthPx.value = 9.0*viewport.width/320;
        mat.uniforms.uLenPx.value = 38.0*viewport.height/320;
      }

      return { mesh, mat, update, onResize, params };
    }

    /* ============== API: 외부에서 사용 ============== */
    function attachOmniFlames(mesh){
      const shellMat = makeShellMaterial();
      const shell = new THREE.Mesh(mesh.geometry, shellMat);
      shell.renderOrder = 2; mesh.add(shell);

      const streaks = createFlameStreaks(mesh, 112);

      const syncBounds = ()=>{
        const { height } = computeWorldYBounds(mesh);
        shellMat.uniforms.uFadeFalloff.value = Math.max(0.06, height * 0.12);
      };
      syncBounds();

      return {
        shell, shellUniforms: shellMat.uniforms, streaks,
        updateBounds: syncBounds,
        detach(){
          mesh.remove(shell); shellMat.dispose();
          scene.remove(streaks.mesh); streaks.mat.dispose(); streaks.mesh.geometry.dispose();
        }
      };
    }


 let numeral=null,numeralMask=null,pack=null,current='';
 const material=new THREE.MeshBasicMaterial({color:'#e89528'});
 const maskMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
 const bounds={width:0,height:0};
 function setValue(value){
  const label=String(Math.floor(Math.max(0,Number.isFinite(value)?value:0)));
  if(label===current)return;current=label;
  if(pack){pack.detach();pack=null;}
  if(numeralMask)maskScene.remove(numeralMask);
  if(numeral){scene.remove(numeral);numeral.geometry.dispose();}
  const text=new TextGeometry(label,{font,size:1,depth:.07,curveSegments:5,bevelEnabled:true,bevelThickness:.012,bevelSize:.008,bevelSegments:1});
  text.computeBoundingBox();const box=text.boundingBox;
  const scale=Math.min(1.08/Math.max(.01,box.max.y-box.min.y),1.8/Math.max(.01,box.max.x-box.min.x));
  bounds.width=(box.max.x-box.min.x)*scale;bounds.height=(box.max.y-box.min.y)*scale;
  text.translate(-(box.min.x+box.max.x)/2,-(box.min.y+box.max.y)/2,-.035);
  text.scale(scale,scale,scale);
  const geometry=new TessellateModifier(.12,3).modify(text);text.dispose();
  numeral=new THREE.Mesh(geometry,material);scene.add(numeral);numeral.updateMatrixWorld(true);
  numeralMask=new THREE.Mesh(geometry,maskMaterial);maskScene.add(numeralMask);
  pack=attachOmniFlames(numeral);
  pack.shellUniforms.uCoverage.value=label==='0'?0:.9;
  pack.streaks.mesh.visible=label!=='0';
  // Warm the lifecycle so first draw contains established fire rather than a burst.
  for(let i=0;i<24;i++)pack.streaks.update(1/30,i/30);
 }
 return {
  bounds,
  setValue,
  update(dt,time){if(!pack)return;pack.shellUniforms.uTime.value=time;pack.streaks.mat.uniforms.uTime.value=time;if(current!=='0' && dt>0)pack.streaks.update(dt,time);},
  resize(){pack?.streaks.onResize();},
  dispose(){pack?.detach();if(numeralMask)maskScene.remove(numeralMask);if(numeral){scene.remove(numeral);numeral.geometry.dispose();}material.dispose();maskMaterial.dispose();}
 };
}
