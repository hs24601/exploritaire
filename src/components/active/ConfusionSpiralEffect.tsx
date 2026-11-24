import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export type ConfusionSpiralConfig = {
  count: number;
  radius: number;
  turns: number;
  tubeRadius: number;
  speed: number;
  waveAmplitude: number;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
};

export const DEFAULT_CONFUSION_SPIRAL_CONFIG: ConfusionSpiralConfig = {
  count: 10,
  radius: 3,
  turns: 5.5,
  tubeRadius: 0.015,
  speed: 0.02,
  waveAmplitude: 0.02,
  color1: '#00ffff',
  color2: '#ff00ff',
  color3: '#0055ff',
  color4: '#ffffff',
  bloomStrength: 0.6,
  bloomRadius: 0.4,
  bloomThreshold: 0.1,
};

export const ConfusionSpiralEffect = memo(function ConfusionSpiralEffect({
  className,
  config = DEFAULT_CONFUSION_SPIRAL_CONFIG,
}: { className?: string; config?: ConfusionSpiralConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    const bgColor = new THREE.Color('#000000');
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2(bgColor, 0.05);

    const camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 100);
    camera.position.set(0, 0, 16);

    const renderer = new THREE.WebGLRenderer({ 
      canvas,
      antialias: true,
      alpha: true 
    });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;

    // --- POST PROCESSING ---
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.offsetWidth, container.offsetHeight),
      config.bloomStrength,
      config.bloomRadius,
      config.bloomThreshold
    );
    composer.addPass(bloomPass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(1 / container.offsetWidth, 1 / container.offsetHeight);
    composer.addPass(fxaaPass);

    // --- GEOMETRY ---
    const getSpiralCurve = (radius: number, turns: number, randomOffset: number) => {
      const points = [];
      const divisions = 100;
      for (let i = 0; i <= divisions; i++) {
        const t = i / divisions;
        const angle = t * Math.PI * 2 * turns + randomOffset;
        const r = radius * (1 - t);
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        const z = Math.sin(t * 12.0 + randomOffset) * 1.5 * (1.0 - t);
        points.push(new THREE.Vector3(x, y, z));
      }
      return new THREE.CatmullRomCurve3(points);
    };

    const spiralGroup = new THREE.Group();
    scene.add(spiralGroup);

    const colors = [
      new THREE.Color(config.color1),
      new THREE.Color(config.color2),
      new THREE.Color(config.color3),
      new THREE.Color(config.color4),
    ];

    const createSpirals = () => {
      // Clear previous
      while(spiralGroup.children.length > 0) {
        const child = spiralGroup.children[0] as THREE.Mesh;
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
        spiralGroup.remove(child);
      }

      for (let i = 0; i < config.count; i++) {
        const curve = getSpiralCurve(config.radius, config.turns, Math.random() * Math.PI * 2);
        const geometry = new THREE.TubeGeometry(curve, 128, config.tubeRadius, 8, false);
        const material = new THREE.MeshBasicMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          transparent: true,
          opacity: 0.8,
        });
        const mesh = new THREE.Mesh(geometry, material);
        // Custom properties for animation
        (mesh as any).userData = {
          offset: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.5
        };
        spiralGroup.add(mesh);
      }
    };

    createSpirals();

    // --- ANIMATION ---
    let rafId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();
      
      spiralGroup.rotation.z = time * config.speed;
      spiralGroup.rotation.x = Math.sin(time * 0.3) * 0.2;
      spiralGroup.rotation.y = Math.cos(time * 0.2) * 0.2;

      spiralGroup.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const { offset, speed } = mesh.userData;
        const wave = Math.sin(time * speed + offset) * config.waveAmplitude;
        mesh.position.z = wave;
        mesh.scale.setScalar(1 + wave * 2);
      });

      composer.render();
      rafId = requestAnimationFrame(animate);
    };

    animate();

    // --- RESIZE ---
    const handleResize = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      fxaaPass.uniforms['resolution'].value.set(1 / w, 1 / h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      // Dispose geometries and materials
      spiralGroup.children.forEach(child => {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    };
  }, [config]);

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-black ${className ?? ''}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-[0.3em] opacity-10">Active Effect: confusion_spiral</div>
      </div>
    </div>
  );
});
