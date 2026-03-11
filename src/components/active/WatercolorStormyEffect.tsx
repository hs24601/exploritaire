import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type WatercolorStormyConfig = {
  scale: number;
  speed: number;
  density: number;
  softness: number;
  color1: string;
  color2: string;
  color3: string;
  bgColor: string;
};

export const DEFAULT_WATERCOLOR_STORMY_CONFIG: WatercolorStormyConfig = {
  scale: 2.0,
  speed: 0.15,
  density: 0.7,
  softness: 0.3,
  color1: '#00f2ff', // Brighter Neon Teal
  color2: '#e600ff', // Brighter Neon Purple
  color3: '#ffcc00', // Gold
  bgColor: '#000000', // Default to Black
};

export const WatercolorStormyEffect = memo(function WatercolorStormyEffect({
  className,
  config = DEFAULT_WATERCOLOR_STORMY_CONFIG,
}: { className?: string; config?: WatercolorStormyConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5));
  const targetMouseRef = useRef(new THREE.Vector2(0.5, 0.5));

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const renderer = new THREE.WebGLRenderer({ 
      canvas,
      antialias: true, 
      alpha: true 
    });
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.offsetWidth, container.offsetHeight);

    const uniforms = {
      u_time: { value: 1.0 },
      u_resolution: { value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_scale: { value: config.scale },
      u_speed: { value: config.speed },
      u_density: { value: config.density },
      u_softness: { value: config.softness },
      u_color1: { value: new THREE.Color(config.color1) },
      u_color2: { value: new THREE.Color(config.color2) },
      u_color3: { value: new THREE.Color(config.color3) },
      u_bgColor: { value: new THREE.Color(config.bgColor) }
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
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_scale;
      uniform float u_speed;
      uniform float u_density;
      uniform float u_softness;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      uniform vec3 u_bgColor;
      
      varying vec2 vUv;

      float hash(vec3 p3) {
        p3  = fract(p3 * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float noise(vec3 x) {
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); 
        return mix(mix(mix( hash(p+vec3(0,0,0)), hash(p+vec3(1,0,0)),f.x),
                       mix( hash(p+vec3(0,1,0)), hash(p+vec3(1,1,0)),f.x),f.y),
                   mix(mix( hash(p+vec3(0,0,1)), hash(p+vec3(1,0,1)),f.x),
                       mix( hash(p+vec3(0,1,1)), hash(p+vec3(1,1,1)),f.x),f.y),f.z);
      }

      float fbm(vec3 x) {
        float v = 0.0;
        float a = 0.5;
        vec3 shift = vec3(100.0);
        for (int i = 0; i < 5; ++i) { 
          v += a * (noise(x) * 2.0 - 1.0);
          x = x * 2.0 + shift;
          a *= 0.5;
        }
        return v; 
      }

      float fbm_wispy(vec3 x) {
        float v = 0.0;
        float a = 0.5;
        vec3 shift = vec3(100.0);
        for (int i = 0; i < 6; ++i) {
          float n = noise(x) * 2.0 - 1.0;
          float ridge = 1.0 - abs(n);
          float soft = n * 0.5 + 0.5;
          v += a * mix(ridge, soft, u_softness);
          x = x * 2.0 + shift;
          a *= 0.5;
        }
        return v; 
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        vec2 mousePos = u_mouse * 2.0 - 1.0;
        mousePos.x *= u_resolution.x / u_resolution.y;

        vec3 p3 = vec3(p * u_scale, u_time * u_speed); 
        p3.y -= u_time * u_speed * 1.5;
        p3.xy -= mousePos * 0.2;

        vec3 q = vec3(
          fbm(p3 + vec3(0.0, u_time * u_speed * 0.5, 0.0)),
          fbm(p3 + vec3(5.2, u_time * u_speed * 0.5, 0.0)),
          0.0
        );

        vec3 r = vec3(
          fbm(p3 + q * 1.5 + vec3(1.7, 9.2, u_time * u_speed * 0.8)),
          fbm(p3 + q * 1.5 + vec3(8.3, 2.8, u_time * u_speed * 0.9)),
          0.0
        );

        float n = fbm_wispy(p3 + r * 1.0);
        float dist = length(p - mousePos);
        float mask = smoothstep(1.6, 0.1, dist); 
        mask *= smoothstep(1.5, -1.0, p.y - mousePos.y);

        float density = n * mask;
        float densityLower = mix(0.7, 0.0, u_density);
        float densityUpper = mix(1.2, 0.5, u_density);
        density = smoothstep(densityLower, densityUpper, density); 

        vec3 smokeColor = mix(u_color1, u_color2, smoothstep(-0.4, 0.4, q.x));
        smokeColor = mix(smokeColor, u_color3, smoothstep(-0.4, 0.4, r.y));
        
        // Boost intensity for black backgrounds
        smokeColor *= mix(0.8, 1.8, n); 

        vec3 finalColor = mix(u_bgColor, smokeColor, density);
        
        // Add a bit of glow based on density
        finalColor += smokeColor * pow(density, 2.0) * 0.3;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetMouseRef.current.x = (event.clientX - rect.left) / container.offsetWidth;
      targetMouseRef.current.y = 1.0 - ((event.clientY - rect.top) / container.offsetHeight);
    };

    container.addEventListener('mousemove', onMouseMove);

    let rafId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      uniforms.u_time.value = clock.getElapsedTime();
      
      mouseRef.current.lerp(targetMouseRef.current, 0.05);
      uniforms.u_mouse.value.copy(mouseRef.current);
      
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.x = w;
      uniforms.u_resolution.value.y = h;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [config]);

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-black ${className ?? ''}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-[0.3em] opacity-10">Active Effect: watercolor_stormy</div>
      </div>
    </div>
  );
});
