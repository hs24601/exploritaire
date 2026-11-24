import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

export type CosmicLintConfig = {
  iterations: number;
  formuparam: number;
  volsteps: number;
  stepsize: number;
  zoom: number;
  cell: number;
  speed: number;
  brightness: number;
  darkmatter: number;
  distfading: number;
  saturation: number;
};

export const DEFAULT_COSMIC_LINT_CONFIG: CosmicLintConfig = {
  iterations: 10,
  formuparam: 0.57,
  volsteps: 10,
  stepsize: 0.2,
  zoom: 1.2,
  cell: 1.0,
  speed: 0.002,
  brightness: 0.0015,
  darkmatter: 0.50,
  distfading: 0.730,
  saturation: 1.0
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;
  varying vec2 vUv;

  uniform int iterations;
  uniform float formuparam;
  uniform int volsteps;
  uniform float stepsize;
  uniform float zoom;
  uniform float cell;
  uniform float speed;
  uniform float brightness;
  uniform float darkmatter;
  uniform float distfading;
  uniform float saturation;

  #define mo (1.0 * iResolution.xy) / iResolution.y

  vec3 r(vec3 v, vec2 r) {
      vec4 t = sin(vec4(r, r + 1.5707963268));
      float g = dot(v.yz, t.yw);
      return vec3(v.x * t.z - g * t.x,
                  v.y * t.w - v.z * t.y,
                  v.x * t.x + g * t.z);
  }

  vec3 iPlane(vec3 ro, vec3 rd, vec3 po, vec3 pd){
      float d = dot(po - ro, pd) / dot(rd, pd);
      return d * rd + ro;
  }

  void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = fragCoord.xy / iResolution.xy - 0.5;
    uv.y *= iResolution.y / iResolution.x;
    vec3 dir = vec3(uv * zoom, 1.0);
    float time = iTime * speed + 0.25;

    vec3 blackholeCenter = vec3(time * 2.0, time, -2.0);
    vec3 from = vec3(0.0, 0.0, -15.0);
    from = r(from, mo / 10.0);
    dir = r(dir, mo / 10.0);
    from += blackholeCenter;

    vec3 nml = normalize(blackholeCenter - from);
    vec3 pos = iPlane(from, dir, blackholeCenter, nml);
    pos = blackholeCenter - pos;
    float intensity = dot(pos, pos);
    
    // Volumetric rendering loop
    float s = 0.1, fade = 1.0;
    vec3 v = vec3(0.0);
    for (int r = 0; r < 20; r++) { // Max volsteps loop
      if (r >= volsteps) break;
      vec3 p = from + s * dir * 0.5;
      p = abs(vec3(cell) - mod(p, vec3(cell * 2.0))); 
      float pa, a = pa = 0.0;
      for (int i = 0; i < 20; i++) { // Max iterations loop
        if (i >= iterations) break;
        p = abs(p) / dot(p, p) - formuparam;
        a += abs(length(p) - pa);
        pa = length(p);
      }
      float dm = max(0.0, darkmatter - a * a * 0.001);
      a *= a * a;
      if (r > 6) fade *= 1.0 - dm;
      v += fade;
      v += vec3(s, s * s, s * s * s * s) * a * brightness * fade;
      fade *= distfading;
      s += stepsize;
    }
    v = mix(vec3(length(v)), v, saturation);
    fragColor = vec4(v * 0.01, 1.0);
  }

  void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
  }
`;

type Props = {
  className?: string;
  config?: CosmicLintConfig;
};

export const CosmicLintAtmosphere = memo(function CosmicLintAtmosphere({ 
  className, 
  config = DEFAULT_COSMIC_LINT_CONFIG 
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
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(mount.clientWidth, mount.clientHeight) },
        iterations: { value: config.iterations },
        formuparam: { value: config.formuparam },
        volsteps: { value: config.volsteps },
        stepsize: { value: config.stepsize },
        zoom: { value: config.zoom },
        cell: { value: config.cell },
        speed: { value: config.speed },
        brightness: { value: config.brightness },
        darkmatter: { value: config.darkmatter },
        distfading: { value: config.distfading },
        saturation: { value: config.saturation }
      }
    });
    materialRef.current = material;

    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    let rafId = 0;
    const animate = (time: number) => {
      material.uniforms.iTime.value = time * 0.001;
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      material.uniforms.iResolution.value.set(w, h);
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
    u.iterations.value = config.iterations;
    u.formuparam.value = config.formuparam;
    u.volsteps.value = config.volsteps;
    u.stepsize.value = config.stepsize;
    u.zoom.value = config.zoom;
    u.cell.value = config.cell;
    u.speed.value = config.speed;
    u.brightness.value = config.brightness;
    u.darkmatter.value = config.darkmatter;
    u.distfading.value = config.distfading;
    u.saturation.value = config.saturation;
  }, [config]);

  return <div ref={rootRef} className={`w-full h-full ${className}`} />;
});

