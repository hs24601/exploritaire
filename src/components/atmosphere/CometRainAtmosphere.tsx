import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

export type CometRainConfig = {
  particleCount: number;
  speed: number;
  drift: number;
  backgroundIntensity: number;
  colorR: number;
  colorG: number;
  colorB: number;
};

export const DEFAULT_COMET_RAIN_CONFIG: CometRainConfig = {
  particleCount: 40,
  speed: 0.1,
  drift: 0.02,
  backgroundIntensity: 9.0,
  colorR: 1.0,
  colorG: 2.0,
  colorB: 3.0
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform vec3 iResolution;
  uniform float iTime;
  varying vec2 vUv;

  uniform int particleCount;
  uniform float speed;
  uniform float drift;
  uniform float backgroundIntensity;
  uniform vec3 customColor;

  // Polyfill for tanh
  vec3 myTanh(vec3 x) {
      vec3 e = exp(2.0 * x);
      return (e - 1.0) / (e + 1.0);
  }

  void main() {
      vec2 r = iResolution.xy;
      // Use vUv to derive coordinate space similar to mainImage logic
      vec2 I = vUv * r;
      vec2 p = (-2.0 * I + r) / r.y * mat2(3, 4, 4, -3) / 2e2;
      vec4 S, C = vec4(customColor, 0.0), W;

      for(int i=0; i < 100; i++) {
          if (i >= particleCount) break;
          float fi = float(i);
          float t = iTime;
          float T = speed * t + p.x;
          
          ///Set color:
          S += (cos(W = sin(fi) * +C) + 1.)
          
          ///Flashing brightness:
          * exp(sin(fi - fi * T))
          
          ///Trail particles with attenuating light:
          / length(max(p,
              p / vec2(1e3, p / exp(W.x) + vec2(fi, t) / 8.) * 100.)
          ) / 1e4;
          
          ///Shift position for each particle:
          p += drift * cos(fi * (C.xz + 8. - fi) + T + T);
      }
      
      //Add sky background and "tanh" tonemap
      vec3 finalCol = myTanh(p.x * backgroundIntensity * vec3(customColor.xy - 1.0, customColor.z - 3.0) + S.xyz * S.xyz);
      gl_FragColor = vec4(finalCol, 1.0);
  }
`;

type Props = {
  className?: string;
  config?: CometRainConfig;
};

export const CometRainAtmosphere = memo(function CometRainAtmosphere({ 
  className, 
  config = DEFAULT_COMET_RAIN_CONFIG 
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(mount.clientWidth, mount.clientHeight, 1.0) },
        particleCount: { value: config.particleCount },
        speed: { value: config.speed },
        drift: { value: config.drift },
        backgroundIntensity: { value: config.backgroundIntensity },
        customColor: { value: new THREE.Color(config.colorR, config.colorG, config.colorB) }
      }
    });
    materialRef.current = material;

    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    let rafId = 0;
    const animate = (time: number) => {
      if (materialRef.current) {
        materialRef.current.uniforms.iTime.value = time * 0.001;
      }
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);

    const resize = () => {
      if (!mount || !materialRef.current) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      materialRef.current.uniforms.iResolution.value.set(w, h, 1.0);
    };
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(rafId);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.particleCount.value = config.particleCount;
    u.speed.value = config.speed;
    u.drift.value = config.drift;
    u.backgroundIntensity.value = config.backgroundIntensity;
    u.customColor.value.setRGB(config.colorR, config.colorG, config.colorB);
  }, [config]);

  return <div ref={rootRef} className={`w-full h-full ${className}`} />;
});
