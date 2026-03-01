import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

// ─── Card constants (match FlipCardDemo) ────────────────────────────────────

export const THREEJS_CARD_W = 140;
export const THREEJS_CARD_H = 196;

// ─── Air element — volumetric cloud ─────────────────────────────────────────

const CLOUD_VERT = /* glsl */`
  in vec3 position;

  uniform mat4 modelMatrix;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform vec3 cameraPos;

  out vec3 vOrigin;
  out vec3 vDirection;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    vOrigin    = vec3( inverse( modelMatrix ) * vec4( cameraPos, 1.0 ) ).xyz;
    vDirection = position - vOrigin;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const CLOUD_FRAG = /* glsl */`
  precision highp float;
  precision highp sampler3D;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;

  in vec3 vOrigin;
  in vec3 vDirection;

  out vec4 color;

  uniform vec3      base;
  uniform sampler3D map;
  uniform float     threshold;
  uniform float     range;
  uniform float     opacity;
  uniform float     steps;
  uniform float     frame;

  uint wang_hash( uint seed ) {
    seed = ( seed ^ 61u ) ^ ( seed >> 16u );
    seed *= 9u;
    seed  = seed ^ ( seed >> 4u );
    seed *= 0x27d4eb2du;
    seed  = seed ^ ( seed >> 15u );
    return seed;
  }

  float randomFloat( inout uint seed ) {
    return float( wang_hash( seed ) ) / 4294967296.;
  }

  vec2 hitBox( vec3 orig, vec3 dir ) {
    const vec3 box_min = vec3( -0.5 );
    const vec3 box_max = vec3(  0.5 );
    vec3 inv_dir  = 1.0 / dir;
    vec3 tmin_tmp = ( box_min - orig ) * inv_dir;
    vec3 tmax_tmp = ( box_max - orig ) * inv_dir;
    vec3 tmin = min( tmin_tmp, tmax_tmp );
    vec3 tmax = max( tmin_tmp, tmax_tmp );
    float t0 = max( tmin.x, max( tmin.y, tmin.z ) );
    float t1 = min( tmax.x, min( tmax.y, tmax.z ) );
    return vec2( t0, t1 );
  }

  float sample1( vec3 p ) { return texture( map, p ).r; }

  float shading( vec3 coord ) {
    float step = 0.01;
    return sample1( coord + vec3( -step ) ) - sample1( coord + vec3( step ) );
  }

  vec4 linearToSRGB( in vec4 value ) {
    return vec4(
      mix(
        pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ),
        value.rgb * 12.92,
        vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) )
      ),
      value.a
    );
  }

  void main() {
    vec3 rayDir  = normalize( vDirection );
    vec2 bounds  = hitBox( vOrigin, rayDir );
    if ( bounds.x > bounds.y ) discard;
    bounds.x = max( bounds.x, 0.0 );

    float stepSize = ( bounds.y - bounds.x ) / steps;

    uint seed    = uint( gl_FragCoord.x ) * uint( 1973 )
                 + uint( gl_FragCoord.y ) * uint( 9277 )
                 + uint( frame )          * uint( 26699 );
    vec3 size    = vec3( textureSize( map, 0 ) );
    float randNum = randomFloat( seed ) * 2.0 - 1.0;
    vec3 p = vOrigin + bounds.x * rayDir;
    p += rayDir * randNum * ( 1.0 / size );

    vec4 ac = vec4( base, 0.0 );

    for ( float i = 0.0; i < steps; i += 1.0 ) {
      float d = sample1( p + 0.5 );
      d = smoothstep( threshold - range, threshold + range, d ) * opacity;
      float col = shading( p + 0.5 ) * 3.0 + ( ( p.x + p.y ) * 0.25 ) + 0.2;
      ac.rgb += ( 1.0 - ac.a ) * d * col;
      ac.a   += ( 1.0 - ac.a ) * d;
      if ( ac.a >= 0.95 ) break;
      p += rayDir * stepSize;
    }

    color = linearToSRGB( ac );
    if ( color.a == 0.0 ) discard;
  }
`;

function buildCloudTexture(): THREE.Data3DTexture {
  const size = 128;
  const data = new Uint8Array( size * size * size );
  const scale = 0.05;
  const perlin = new ImprovedNoise();
  const vector = new THREE.Vector3();
  let i = 0;
  for ( let z = 0; z < size; z++ ) {
    for ( let y = 0; y < size; y++ ) {
      for ( let x = 0; x < size; x++ ) {
        const d = 1.0 - vector.set( x, y, z ).subScalar( size / 2 ).divideScalar( size ).length();
        data[ i ] = ( 128 + 128 * perlin.noise( x * scale / 1.5, y * scale, z * scale / 1.5 ) ) * d * d;
        i++;
      }
    }
  }
  const texture = new THREE.Data3DTexture( data, size, size, size );
  texture.format = THREE.RedFormat;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

export const AirCloudCard = memo(function AirCloudCard({
  width = THREEJS_CARD_W,
  height = THREEJS_CARD_H,
}: {
  width?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
    renderer.setSize( width, height );
    container.appendChild( renderer.domElement );

    // ── Scene & Camera ────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera( 60, width / height, 0.1, 100 );
    camera.position.set( 0, 0, 1.5 );

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // ── Sky gradient ──────────────────────────────────────────────────────
    const skyCanvas = document.createElement( 'canvas' );
    skyCanvas.width  = 1;
    skyCanvas.height = 32;
    const ctx = skyCanvas.getContext( '2d' )!;
    const grad = ctx.createLinearGradient( 0, 0, 0, 32 );
    grad.addColorStop( 0.0, '#014a84' );
    grad.addColorStop( 0.5, '#0561a0' );
    grad.addColorStop( 1.0, '#437ab6' );
    ctx.fillStyle = grad;
    ctx.fillRect( 0, 0, 1, 32 );
    const skyMap = new THREE.CanvasTexture( skyCanvas );
    skyMap.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.SphereGeometry( 10 );
    const skyMat = new THREE.MeshBasicMaterial( { map: skyMap, side: THREE.BackSide } );
    const sky = new THREE.Mesh( skyGeo, skyMat );
    scene.add( sky );

    // ── Cloud volume ──────────────────────────────────────────────────────
    const cloudTexture = buildCloudTexture();

    const material = new THREE.RawShaderMaterial( {
      glslVersion: THREE.GLSL3,
      uniforms: {
        base:      { value: new THREE.Color( 0x798aa0 ) },
        map:       { value: cloudTexture },
        cameraPos: { value: new THREE.Vector3() },
        threshold: { value: 0.25 },
        opacity:   { value: 0.25 },
        range:     { value: 0.1 },
        steps:     { value: 100 },
        frame:     { value: 0 },
      },
      vertexShader:   CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      side:        THREE.BackSide,
      transparent: true,
    } );

    const cloudGeo  = new THREE.BoxGeometry( 1, 1, 1 );
    const mesh = new THREE.Mesh( cloudGeo, material );
    scene.add( mesh );

    // ── Animation loop ────────────────────────────────────────────────────
    let rafId: number;

    const animate = () => {
      rafId = requestAnimationFrame( animate );
      controls.update();
      material.uniforms.cameraPos.value.copy( camera.position );
      mesh.rotation.y = -performance.now() / 7500;
      material.uniforms.frame.value++;
      renderer.render( scene, camera );
    };
    animate();

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame( rafId );
      controls.dispose();
      cloudTexture.dispose();
      material.dispose();
      cloudGeo.dispose();
      skyGeo.dispose();
      skyMat.map?.dispose();
      skyMat.dispose();
      renderer.dispose();
      if ( container.contains( renderer.domElement ) ) {
        container.removeChild( renderer.domElement );
      }
    };
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 28px rgba(0,0,0,0.6), 0 0 18px #87ceeb44',
        cursor: 'grab',
        flexShrink: 0,
      }}
    />
  );
});

// ─── Ice element — WebGL2 ray-marched glass/ice box ──────────────────────────
// Shader technique by Matthias Hurrle (@atzedent). Animation disabled; fixed
// diagonal camera.  Pointer drag rotates the view.

const ICE_VERT_RAW = /* glsl */`#version 300 es
precision highp float;
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const ICE_FRAG_RAW = /* glsl */`#version 300 es
precision highp float;

uniform vec2 iResolution;
out vec4 fragColor;

// ── Rotation matrices ──────────────────────────────────────────────────────
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1,0,0, 0,c,-s, 0,s,c);
}
mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,0,s, 0,1,0, -s,0,c);
}
mat3 rotZ(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,-s,0, s,c,0, 0,0,1);
}

// ── Wang hash jitter ───────────────────────────────────────────────────────
float rnd(uint n) {
  n = (n ^ 61u) ^ (n >> 16u);
  n *= 9u;
  n ^= n >> 4u;
  n *= 0x27d4eb2du;
  n ^= n >> 15u;
  return float(n) / 4294967295.0;
}

// ── Value noise (3-D) ──────────────────────────────────────────────────────
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = dot(i, vec3(1.0, 157.0, 113.0));
  vec4 v = fract(sin(vec4(n, n+1.0, n+157.0, n+158.0)) * 43758.5453123);
  vec4 w = fract(sin(vec4(n+113.0, n+114.0, n+270.0, n+271.0)) * 43758.5453123);
  return mix(
    mix(mix(v.x,v.y,f.x), mix(v.z,v.w,f.x), f.y),
    mix(mix(w.x,w.y,f.x), mix(w.z,w.w,f.x), f.y),
    f.z
  );
}

// ── Smooth min ─────────────────────────────────────────────────────────────
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// ── Box SDF ────────────────────────────────────────────────────────────────
float box(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// ── Scene SDF — noisy glass box ────────────────────────────────────────────
float map(vec3 p) {
  float n = noise(p * 2.1) * 0.07 + noise(p * 5.4) * 0.035;
  return box(p, vec3(1.1, 1.5, 1.1)) + n;
}

// ── Normal by central differences ─────────────────────────────────────────
vec3 norm(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

// ── Ray direction from aspect-correct UV ──────────────────────────────────
vec3 dir(vec2 uv, vec3 ro, vec3 ta) {
  vec3 f = normalize(ta - ro);
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  return normalize(f + uv.x * r + uv.y * u);
}

// ── Sky environment ────────────────────────────────────────────────────────
vec3 sky(vec3 d) {
  float t = clamp(0.5 + 0.5 * d.y, 0.0, 1.0);
  return mix(vec3(0.01, 0.03, 0.09), vec3(0.38, 0.65, 1.0), t * t);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - iResolution * 0.5) / min(iResolution.x, iResolution.y);

  // ── Camera — fixed diagonal view, close to fill the card ─────────────
  vec3 ro = vec3(0.0, 0.0, -2.2);
  ro = rotX(-0.42) * ro;
  ro = rotY( 0.65) * ro;

  vec3 ta = vec3(0.0);
  vec3 rd = dir(uv, ro, ta);

  // ── Primary ray march ──────────────────────────────────────────────────
  float t = 0.1;
  bool hit = false;
  // Wang hash jitter to suppress banding
  t += rnd(uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u) * 0.15;
  for (int i = 0; i < 110; i++) {
    float d = map(ro + rd * t);
    if (d < 0.0006 * (1.0 + t * 0.1)) { hit = true; break; }
    t += d * 0.85;
    if (t > 14.0) break;
  }

  vec3 col = sky(rd);

  if (hit) {
    vec3 p  = ro + rd * t;
    vec3 n  = norm(p);

    float eta = 0.65;                     // glass/ice IOR ratio
    vec3 refrDir = refract(rd, n, eta);
    vec3 reflDir = reflect(rd, n);
    float fres = pow(1.0 - abs(dot(n, -rd)), 4.0);

    // Refracted ray — march to back face then exit
    vec3 refrCol = sky(refrDir);
    if (dot(refrDir, refrDir) > 0.5) {
      vec3 rp = p + refrDir * 0.04;
      for (int j = 0; j < 48; j++) {
        if (map(rp) > 0.001) break;
        rp += refrDir * 0.05;
      }
      vec3 n2     = norm(rp);
      vec3 refr2  = refract(refrDir, -n2, 1.0 / eta);
      if (dot(refr2, refr2) > 0.5) refrCol = sky(refr2);
      else                          refrCol = sky(reflect(refrDir, -n2));
    }

    // Ice tint (noise-driven depth variation)
    vec3 iceTint = vec3(0.55, 0.84, 0.98);
    float depth  = noise(p * 3.5) * 0.4 + noise(p * 8.2) * 0.2;
    iceTint = mix(iceTint, vec3(0.10, 0.30, 0.80), depth * 0.48);

    col = mix(refrCol, sky(reflDir), fres) * iceTint;

    // Specular highlight
    vec3  L    = normalize(vec3(0.5, 1.0, 0.3));
    float spec = pow(max(dot(reflDir, L), 0.0), 72.0);
    col += vec3(0.88, 0.96, 1.00) * spec * 0.75;

    // Rim / edge glow
    col += vec3(0.06, 0.20, 0.55) * fres * 0.45;
  }

  // Tone-map + gamma
  col = col / (col + 0.75);
  col = pow(max(col, 0.0), vec3(0.4545));

  fragColor = vec4(col, 1.0);
}
`;

export const IceElementCard = memo(function IceElementCard({
  width  = THREEJS_CARD_W,
  height = THREEJS_CARD_H,
}: {
  width?:  number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(width  * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // ── Compile helpers ────────────────────────────────────────────────
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[IceCard] shader error:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vert = compile(gl.VERTEX_SHADER,   ICE_VERT_RAW);
    const frag = compile(gl.FRAGMENT_SHADER, ICE_FRAG_RAW);
    if (!vert || !frag) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[IceCard] link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // ── Full-screen quad ───────────────────────────────────────────────
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // ── Uniforms ───────────────────────────────────────────────────────
    const uRes = gl.getUniformLocation(prog, 'iResolution');
    gl.uniform2f(uRes, canvas.width, canvas.height);

    // ── Render loop ────────────────────────────────────────────────────
    let rafId = 0;
    let disposed = false;

    const render = () => {
      if (disposed) return;
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    // ── Cleanup ────────────────────────────────────────────────────────
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        borderRadius: 12,
        display:     'block',
        boxShadow:  '0 0 0 1px rgba(255,255,255,0.10), 0 8px 28px rgba(0,0,0,0.7), 0 0 24px #00bfff44',
        cursor:     'default',
        flexShrink: 0,
      }}
    />
  );
});

// ─── Fire element — FBM noise flame shader ───────────────────────────────────
// Shader technique by janeRivas / inspired by Yuri Artiukh (Akella).

const FIRE_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
}
`;

const FIRE_FRAG = /* glsl */`
uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uColor1;
uniform vec3  uColor2;

varying vec2 vUv;

float random(in vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(in vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) +
    (c - a) * u.y * (1.0 - u.x) +
    (d - b) * u.x * u.y;
}

#define OCTAVES 6
float fbm(in vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    value += amplitude * noise(st);
    st *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  float velocity   = 60.001;
  float scale      = 0.01;
  float brightness = 0.8;
  float shift      = 1.0;

  vec2  coord  = vec2(gl_FragCoord.x, gl_FragCoord.y - uTime * velocity) * scale;
  float noise1 = fbm(coord);
  float noise2 = brightness * (fbm(coord + noise1 - (uTime / 6.0)) * shift);

  // Vertical fade: bright at base, burns out toward top
  // Multiplier of 1.5 places the flame tip at ~65% of card height
  vec3 verticalGradient = vec3(1.5 * gl_FragCoord.y / uResolution.y) - 0.5;

  vec3 cDark = vec3(15.0, 17.0, 26.0) / 255.0;
  vec3 color = mix(uColor1 / 255.0, cDark, noise2) + mix(uColor2 / 255.0, cDark, noise1);

  vec3 fire = color - verticalGradient - noise2 + noise1;
  gl_FragColor = vec4(fire, 1.0);
}
`;

export const FireElementCard = memo(function FireElementCard({
  width  = THREEJS_CARD_W,
  height = THREEJS_CARD_H,
}: {
  width?:  number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor('#0F111A', 1);
    container.appendChild(renderer.domElement);

    // FOV chosen so a height-1 plane exactly fills the canvas height at z=2
    const fov = 2 * (180 / Math.PI) * Math.atan(1 / (2 * 2));
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.001, 1000);
    camera.position.set(0, 0, 2);

    const scene = new THREE.Scene();

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uResolution: { value: new THREE.Vector2(width, height) },
        uTime:       { value: 0 },
        uColor1:     { value: new THREE.Vector3(255, 82,  83)  },  // red
        uColor2:     { value: new THREE.Vector3(255, 203, 107) },  // orange
      },
      vertexShader:   FIRE_VERT,
      fragmentShader: FIRE_FRAG,
    });

    const mesh = new THREE.Mesh(geometry, material);
    // Landscape cards need scaling; portrait cards are already covered
    const aspect = width / height;
    if (aspect > 1) mesh.scale.set(aspect, aspect, 1);
    scene.add(mesh);

    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      material.uniforms.uTime.value += 0.05;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        borderRadius: 12,
        overflow:  'hidden',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 28px rgba(0,0,0,0.6), 0 0 28px #ff330055',
        flexShrink: 0,
      }}
    />
  );
});

// ─── Water element — water-surface distortion shader ─────────────────────────
// Shader by ksenia-k.  Simplex-noise water ripples distort a texture beneath.

const WATER_VERT = /* glsl */`
precision mediump float;
varying vec2 vUv;
attribute vec2 a_position;
void main() {
    vUv = .5 * (a_position + 1.);
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const WATER_FRAG = /* glsl */`
precision mediump float;

varying vec2 vUv;
uniform sampler2D u_image_texture;
uniform float u_time;
uniform float u_ratio;
uniform float u_img_ratio;
uniform float u_blueish;
uniform float u_scale;
uniform float u_illumination;
uniform float u_surface_distortion;
uniform float u_water_distortion;

vec3 mod289(vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(vec2 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec3 permute(vec3 x) { return mod289(((x * 34.) + 1.) * x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.);
    m = m * m;
    m = m * m;
    vec3 x  = 2. * fract(p * C.www) - 1.;
    vec3 h  = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130. * dot(m, g);
}

mat2 rotate2D(float r) {
    return mat2(cos(r), sin(r), -sin(r), cos(r));
}

float surface_noise(vec2 uv, float t, float scale) {
    vec2 n = vec2(.1);
    vec2 N = vec2(.1);
    mat2 m = rotate2D(.5);
    for (int j = 0; j < 10; j++) {
        uv *= m;
        n  *= m;
        vec2 q = uv * scale + float(j) + n + (.5 + .5 * float(j)) * (mod(float(j), 2.) - 1.) * t;
        n  += sin(q);
        N  += cos(q) / scale;
        scale *= 1.2;
    }
    return (N.x + N.y + .1);
}

void main() {
    vec2 uv = vUv;
    uv.y = 1. - uv.y;
    uv.x *= u_ratio;

    float t = .002 * u_time;

    float outer_noise      = snoise((.3 + .1 * sin(t)) * uv + vec2(0., .2 * t));
    vec2  surface_noise_uv = 2. * uv + (outer_noise * .2);
    // Local var renamed to avoid shadowing the function above
    float sn               = surface_noise(surface_noise_uv, t, u_scale);
    sn *= pow(uv.y, .3);
    sn  = pow(sn, 2.);

    vec2 img_uv = vUv;
    img_uv -= .5;
    if (u_ratio > u_img_ratio) {
        img_uv.x = img_uv.x * u_ratio / u_img_ratio;
    } else {
        img_uv.y = img_uv.y * u_img_ratio / u_ratio;
    }
    img_uv *= 1.4;
    img_uv += .5;
    img_uv.y = 1. - img_uv.y;

    img_uv += (u_water_distortion   * outer_noise);
    img_uv += (u_surface_distortion * sn);

    vec4 img = texture2D(u_image_texture, img_uv);
    img *= (1. + u_illumination * sn);

    vec3 color = img.rgb + u_illumination * vec3(1. - u_blueish, 1., 1.) * sn;

    gl_FragColor = vec4(color, 1.0);
}
`;

export const WaterElementCard = memo(function WaterElementCard({
  width  = THREEJS_CARD_W,
  height = THREEJS_CARD_H,
}: {
  width?:  number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W   = Math.round(width  * dpr);
    const H   = Math.round(height * dpr);
    canvas.width  = W;
    canvas.height = H;

    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) return;

    gl.viewport(0, 0, W, H);

    // ── Compile helpers ───────────────────────────────────────────────────
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[WaterCard] shader error:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    const vert = compile(gl.VERTEX_SHADER,   WATER_VERT);
    const frag = compile(gl.FRAGMENT_SHADER, WATER_FRAG);
    if (!vert || !frag) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[WaterCard] link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // ── Collect uniforms ──────────────────────────────────────────────────
    const u: Record<string, WebGLUniformLocation | null> = {};
    const numUniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) u[info.name] = gl.getUniformLocation(prog, info.name);
    }

    gl.uniform1f(u.u_blueish,            0.6);
    gl.uniform1f(u.u_scale,              7.0);
    gl.uniform1f(u.u_illumination,       0.25);
    gl.uniform1f(u.u_surface_distortion, 0.07);
    gl.uniform1f(u.u_water_distortion,   0.03);
    gl.uniform1f(u.u_ratio,              W / H);

    // ── Fullscreen quad ───────────────────────────────────────────────────
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // ── Procedural deep-ocean background texture ──────────────────────────
    const bg  = document.createElement('canvas');
    bg.width  = 512;
    bg.height = 512;
    const ctx = bg.getContext('2d')!;

    // Base deep-water gradient
    const grd = ctx.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0.0, '#020c1c');
    grd.addColorStop(0.4, '#051830');
    grd.addColorStop(0.8, '#082040');
    grd.addColorStop(1.0, '#040f22');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 512);

    // Underwater light blobs / caustic volumes
    const blobs: [number, number, number, number, number, number, number][] = [
      [200, 130, 180, 0.22, 28, 95, 195],
      [360, 220, 140, 0.16, 18, 75, 175],
      [ 70, 320, 120, 0.13, 22, 105, 188],
      [440, 390, 160, 0.11, 14, 68, 168],
      [265, 460, 110, 0.09, 20, 88, 182],
    ];
    for (const [x, y, r, a, R, G, B] of blobs) {
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
      g2.addColorStop(0, `rgba(${R},${G},${B},${a})`);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, 512, 512);
    }

    // Faint horizontal caustic bands
    for (let y = 0; y < 512; y += 34) {
      ctx.fillStyle = 'rgba(22,85,195,0.04)';
      ctx.fillRect(0, y, 512, 6);
    }

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg);
    gl.uniform1i(u.u_image_texture, 0);
    gl.uniform1f(u.u_img_ratio, 1.0); // square procedural texture

    // ── Render loop ───────────────────────────────────────────────────────
    let rafId = 0;
    let disposed = false;

    const render = () => {
      if (disposed) return;
      gl.uniform1f(u.u_time, performance.now());
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        borderRadius: 12,
        display:     'block',
        boxShadow:   '0 0 0 1px rgba(255,255,255,0.08), 0 8px 28px rgba(0,0,0,0.6), 0 0 24px #0055ff33',
        flexShrink:  0,
      }}
    />
  );
});

// ─── Tab content ─────────────────────────────────────────────────────────────

const THREEJS_CARDS = [
  {
    id:     'air',
    label:  'Air',
    glow:   '#87ceeb',
    render: () => <AirCloudCard />,
  },
  {
    id:     'ice',
    label:  'Ice',
    glow:   '#a0d8ef',
    render: () => <IceElementCard />,
  },
  {
    id:     'fire',
    label:  'Fire',
    glow:   '#ff5533',
    render: () => <FireElementCard />,
  },
  {
    id:     'water',
    label:  'Water',
    glow:   '#0077ff',
    render: () => <WaterElementCard />,
  },
] as const;

export const ThreeJsElementsDemo = memo(function ThreeJsElementsDemo() {
  return (
    <div className="h-full overflow-y-auto pr-4 custom-scrollbar pb-10">
      <div className="space-y-8">

        {/* Cards grid — matches Flip Animation layout */}
        <div className="flex flex-wrap gap-8 items-end">
          {THREEJS_CARDS.map( ( card ) => (
            <div key={card.id} className="flex flex-col items-center gap-3">
              {card.render()}
              <div className="text-[9px] uppercase tracking-[0.18em] text-game-gold/80 text-center font-bold">
                {card.label}
              </div>
            </div>
          ) )}
        </div>

        {/* Technique notes */}
        <div className="border-t border-game-teal/10 pt-6 space-y-4">
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-game-teal/70">Air — Volumetric Cloud</h3>
            <ul className="space-y-1 text-[9px] text-game-white/40 font-mono list-none">
              <li>WebGL2 Data3DTexture — 128³ voxel density field</li>
              <li>Ray-marching with Wang hash jitter — no banding artefacts</li>
              <li>ImprovedNoise (Perlin) — spherical falloff cloud shape</li>
              <li>GLSL3 RawShaderMaterial — direct GPU shader control</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-game-teal/70">Ice — Ray-Marched Glass Box</h3>
            <ul className="space-y-1 text-[9px] text-game-white/40 font-mono list-none">
              <li>Raw WebGL2 — no Three.js, fullscreen-quad GLSL3 shader</li>
              <li>Box SDF + noise perturbation — organic glass surface</li>
              <li>Refraction + reflection + Fresnel — physically-based ice look</li>
              <li>Wang hash jitter — eliminates ray-march banding artefacts</li>
              <li>Fixed diagonal camera — fills the card frame</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-game-teal/70">Fire — FBM Flame Shader</h3>
            <ul className="space-y-1 text-[9px] text-game-white/40 font-mono list-none">
              <li>Three.js ShaderMaterial — standard vertex + custom fragment</li>
              <li>6-octave FBM noise — turbulent flame shape</li>
              <li>Double-noise feedback — fbm(coord + noise1) warps the flame</li>
              <li>Vertical gradient mask — fire burns bright at base, fades at top</li>
              <li>uColor1 / uColor2 uniforms — red + orange fire palette</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-game-teal/70">Water — Simplex-Noise Surface Distortion</h3>
            <ul className="space-y-1 text-[9px] text-game-white/40 font-mono list-none">
              <li>Raw WebGL1 — attribute/varying pipeline, no Three.js</li>
              <li>OpenSimplex noise (GLSL) — large outer waves drive UV warp</li>
              <li>10-iteration rotated surface noise — high-frequency ripple glints</li>
              <li>Double-layer distortion — outer + surface offsets on texture UVs</li>
              <li>Procedural ocean background — deep-blue gradient + caustic blobs</li>
            </ul>
          </div>
          <p className="text-[9px] text-game-white/30 font-mono italic">Drag on Air to orbit.</p>
        </div>

      </div>
    </div>
  );
});
