import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

export type VortexGlassConfig = {
  vortexColor1: string;
  vortexColor2: string;
  vortexSpeed: number;
  swirlStrength: number;
  glassIOR: number;
  glassThickness: number;
  dispersion: number;
};

export const DEFAULT_VORTEX_GLASS_CONFIG: VortexGlassConfig = {
  vortexColor1: '#4400ff',
  vortexColor2: '#00ffff',
  vortexSpeed: 0.5,
  swirlStrength: 4.0,
  glassIOR: 1.5,
  glassThickness: 0.5,
  dispersion: 5.0,
};

const VORTEX_VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vPosition;
uniform float uTime;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const VORTEX_FRAG = /* glsl */`
varying vec2 vUv;
varying vec3 vPosition;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uSwirlStrength;
uniform float uSpeed;

// --- Noise Functions ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float dist = length(uv);
  
  // Swirl - using a small offset to avoid log(0)
  float angle = -log2(dist + 0.05) * uSwirlStrength;
  mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 rotatedUV = rot * uv;
  
  // Inward flow 3D noise
  vec3 noiseInput = vec3(rotatedUV * 2.5, uTime * uSpeed);
  float n = fbm(noiseInput);
  
  // Color & Masking
  vec3 color = mix(uColor1, uColor2, n * 0.5 + 0.5);
  
  // Radial mask to keep it circular
  float alpha = smoothstep(0.9, 0.2, dist) * (n * 0.5 + 0.5);
  
  // Depth-based fade (z is -0.7 to 0.7 approx)
  float zFade = smoothstep(1.2, 0.0, abs(vPosition.z));
  alpha *= zFade;

  // Boost brightness
  color *= 1.5;

  gl_FragColor = vec4(color, alpha);
}
`;

export const VortexGlassEffect = memo(function VortexGlassEffect({
  className,
  config = DEFAULT_VORTEX_GLASS_CONFIG,
}: {
  className?: string;
  config?: VortexGlassConfig;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.offsetWidth;
    const height = container.offsetHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Important for transmissive materials
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Add a dark background to the scene to help with transmission visibility
    scene.background = new THREE.Color('#060e1b');

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xffffff, 30);
    pointLight1.position.set(5, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(new THREE.Color(config.vortexColor1), 20);
    pointLight2.position.set(-5, -5, 2);
    scene.add(pointLight2);

    // Vortex Group
    const vortexGroup = new THREE.Group();
    vortexGroup.renderOrder = 1; // Render BEFORE transmissive glass
    
    const vortexGeo = new THREE.PlaneGeometry(2.2, 2.2, 32, 32);
    const vortexMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(config.vortexColor1) },
        uColor2: { value: new THREE.Color(config.vortexColor2) },
        uSwirlStrength: { value: config.swirlStrength },
        uSpeed: { value: config.vortexSpeed },
      },
      vertexShader: VORTEX_VERT,
      fragmentShader: VORTEX_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const layerCount = 25;
    for (let i = 0; i < layerCount; i++) {
      const mesh = new THREE.Mesh(vortexGeo, vortexMat);
      const t = i / (layerCount - 1);
      mesh.position.z = (t - 0.5) * 1.6;
      const s = 1.0 - Math.pow(Math.abs(t - 0.5) * 2.0, 2.0) * 0.5;
      mesh.scale.set(s, s, 1);
      vortexGroup.add(mesh);
    }
    scene.add(vortexGroup);

    // Glass Sphere
    const glassGeo = new THREE.SphereGeometry(1.3, 64, 64);
    const glassMat = new THREE.MeshPhysicalMaterial({
      transmission: 1.0,
      thickness: config.glassThickness,
      ior: config.glassIOR,
      roughness: 0.05,
      metalness: 0.1,
      dispersion: config.dispersion,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide, // Ensure we see back and front
    });
    const glassSphere = new THREE.Mesh(glassGeo, glassMat);
    glassSphere.renderOrder = 2; // Render AFTER vortex
    scene.add(glassSphere);

    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      vortexMat.uniforms.uTime.value = performance.now() * 0.001;
      vortexGroup.rotation.y += 0.005;
      vortexGroup.rotation.z += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      vortexGeo.dispose();
      vortexMat.dispose();
      glassGeo.dispose();
      glassMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [config]);

  return (
    <div className={`w-full h-full flex items-center justify-center ${className ?? ''}`}>
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-10">Active Effect: vortex_glass</div>
      </div>
    </div>
  );
});
