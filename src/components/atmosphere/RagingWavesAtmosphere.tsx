import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type RagingWavesConfig = {
  bigWavesElevation: number;
  bigWavesFrequencyX: number;
  bigWavesFrequencyY: number;
  bigWaveSpeed: number;
  smallWavesElevation: number;
  smallWavesFrequency: number;
  smallWavesSpeed: number;
  smallWavesIterations: number;
  depthColor: string;
  surfaceColor: string;
  colorOffset: number;
  colorMultiplier: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
};

export const DEFAULT_RAGING_WAVES_CONFIG: RagingWavesConfig = {
  bigWavesElevation: 0.2,
  bigWavesFrequencyX: 4,
  bigWavesFrequencyY: 2,
  bigWaveSpeed: 0.75,
  smallWavesElevation: 0.15,
  smallWavesFrequency: 3,
  smallWavesSpeed: 0.2,
  smallWavesIterations: 4,
  depthColor: "#1e4d40",
  surfaceColor: "#4d9aaa",
  colorOffset: 0.08,
  colorMultiplier: 5,
  fogColor: "#8e99a2",
  fogNear: 1,
  fogFar: 3
};

const vertexShader = `
  #include <fog_pars_vertex>

uniform float uTime;

uniform float uBigWavesElevation;
uniform vec2 uBigWavesFrequency;
uniform float uBigWaveSpeed;

uniform  float uSmallWavesElevation;
uniform  float uSmallWavesFrequency;
uniform  float uSmallWavesSpeed;
uniform float uSmallWavesIterations;

varying float vElevation;

//Classic Perlin 3D Noise 
//by Stefan Gustavson
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
  return 2.2 * n_xyz;
}

void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <fog_vertex>
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  float elevation = 
    sin(modelPosition.x * uBigWavesFrequency.x + uTime * uBigWaveSpeed) 
    * sin(modelPosition.z * uBigWavesFrequency.y + uTime * uBigWaveSpeed) 
    * uBigWavesElevation;
  
  for(float i = 1.0; i <= 10.0; i++) {
   
    elevation -= abs(
      cnoise(
        vec3(modelPosition.xz * uSmallWavesFrequency * i, uTime * uSmallWavesSpeed)
        ) 
        * uSmallWavesElevation / i
      );
     if(i >= uSmallWavesIterations ) {
      break;
    }
  }
  
  modelPosition.y += elevation;
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;
  gl_Position = projectedPosition;

  vElevation = elevation;
}
`;

const fragmentShader = `
  #include <fog_pars_fragment>
precision mediump float;
uniform vec3 uDepthColor;
uniform vec3 uSurfaceColor;

uniform float uColorOffset;
uniform float uColorMultiplier;

varying float vElevation;

void main() {
  float mixStrength = (vElevation + uColorOffset) * uColorMultiplier;
  vec3 color = mix(uDepthColor, uSurfaceColor, mixStrength);
  gl_FragColor = vec4(color, 1.0);
   #include <fog_fragment>
}
`;

type Props = {
  className?: string;
  config?: RagingWavesConfig;
  enableControls?: boolean;
};

export const RagingWavesAtmosphere = memo(function RagingWavesAtmosphere({ 
  className, 
  config = DEFAULT_RAGING_WAVES_CONFIG,
  enableControls = false
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.Fog(
      config.fogColor,
      config.fogNear,
      config.fogFar
    );
    scene.background = new THREE.Color(config.fogColor);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(1, 1, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const waterGeometry = new THREE.PlaneGeometry(12, 12, 512, 512);

    const waterMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      fog: true,
      uniforms: {
        uTime: { value: 0 },
        uBigWavesElevation: { value: config.bigWavesElevation },
        uBigWavesFrequency: { value: new THREE.Vector2(config.bigWavesFrequencyX, config.bigWavesFrequencyY) },
        uBigWaveSpeed: { value: config.bigWaveSpeed },
        uSmallWavesElevation: { value: config.smallWavesElevation },
        uSmallWavesFrequency: { value: config.smallWavesFrequency },
        uSmallWavesSpeed: { value: config.smallWavesSpeed },
        uSmallWavesIterations: { value: config.smallWavesIterations },
        uDepthColor: { value: new THREE.Color(config.depthColor) },
        uSurfaceColor: { value: new THREE.Color(config.surfaceColor) },
        uColorOffset: { value: config.colorOffset },
        uColorMultiplier: { value: config.colorMultiplier },
        ...THREE.UniformsLib["fog"]
      }
    });
    materialRef.current = waterMaterial;

    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI * 0.5;
    scene.add(water);

    let controls: OrbitControls | null = null;
    if (enableControls) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
    }

    let rafId = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      waterMaterial.uniforms.uTime.value = elapsedTime;

      if (controls) controls.update();

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(rafId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      waterGeometry.dispose();
      waterMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  // Update uniforms when config changes
  useEffect(() => {
    if (!materialRef.current) return;
    const uniforms = materialRef.current.uniforms;
    uniforms.uBigWavesElevation.value = config.bigWavesElevation;
    uniforms.uBigWavesFrequency.value.set(config.bigWavesFrequencyX, config.bigWavesFrequencyY);
    uniforms.uBigWaveSpeed.value = config.bigWaveSpeed;
    uniforms.uSmallWavesElevation.value = config.smallWavesElevation;
    uniforms.uSmallWavesFrequency.value = config.smallWavesFrequency;
    uniforms.uSmallWavesSpeed.value = config.smallWavesSpeed;
    uniforms.uSmallWavesIterations.value = config.smallWavesIterations;
    uniforms.uDepthColor.value.set(config.depthColor);
    uniforms.uSurfaceColor.value.set(config.surfaceColor);
    uniforms.uColorOffset.value = config.colorOffset;
    uniforms.uColorMultiplier.value = config.colorMultiplier;

    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(config.fogColor);
      sceneRef.current.fog = new THREE.Fog(config.fogColor, config.fogNear, config.fogFar);
    }
  }, [config]);

  return <div ref={rootRef} className={`w-full h-full ${className}`} />;
});
