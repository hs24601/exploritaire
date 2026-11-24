import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

type Props = {
  className?: string;
  legacyMode?: boolean;
};

type LayerConfig = {
  count: number;
  size: number;
  colorRange: { hue: [number, number]; sat: [number, number]; light: [number, number] };
  speed: number;
};

const getLayerConfigs = (legacyMode: boolean): LayerConfig[] => [
  {
    // Foreground / Fast
    count: legacyMode ? 15000 : 2000,
    size: legacyMode ? 0.35 : 0.45,
    colorRange: { hue: [0.75, 0.9], sat: [0.7, 1], light: [0.5, 0.7] },
    speed: 0.2,
  },
  {
    // Midground
    count: legacyMode ? 20000 : 3000,
    size: legacyMode ? 0.25 : 0.35,
    colorRange: { hue: [0.45, 0.6], sat: [0.6, 0.8], light: [0.4, 0.6] },
    speed: 0.1,
  },
  {
    // Deep Core (fills the center)
    count: legacyMode ? 10000 : 2000,
    size: 0.25,
    colorRange: { hue: [0.6, 0.85], sat: [0.5, 0.7], light: [0.3, 0.5] },
    speed: 0.04,
  }
];

const TUNNEL_DEPTH = 700;
const SPAWN_Z = -600;
const KILL_Z = 120;

function createParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture(canvas);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const PetrovaLineAtmosphere = memo(function PetrovaLineAtmosphere({ className, legacyMode = false }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    // Slightly push out fog to show more depth
    scene.fog = new THREE.Fog(0x020110, 5, 600); 
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, legacyMode ? 2 : 1.5));
    renderer.setClearColor(0x020110, 0);
    mount.appendChild(renderer.domElement);
    const composer = legacyMode ? new EffectComposer(renderer) : null;
    const bloomPass = legacyMode ? new UnrealBloomPass(new THREE.Vector2(1, 1), 1.6, 0.4, 0.85) : null;
    if (composer) {
      composer.addPass(new RenderPass(scene, camera));
      if (bloomPass) {
        bloomPass.threshold = 0;
        bloomPass.radius = 0.7;
        composer.addPass(bloomPass);
      }
    }

    const particleTexture = createParticleTexture();
    const particleLayers: THREE.Points[] = [];

    for (const config of getLayerConfigs(legacyMode)) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(config.count * 3);
      const colors = new Float32Array(config.count * 3);

      for (let i = 0; i < config.count; i += 1) {
        const i3 = i * 3;
        
        // Removed minimum radius of 10 to fill the center hole
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 140;
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 1] = Math.sin(angle) * radius;
        positions[i3 + 2] = SPAWN_Z + Math.random() * TUNNEL_DEPTH;

        const hue = THREE.MathUtils.lerp(config.colorRange.hue[0], config.colorRange.hue[1], Math.random());
        const sat = THREE.MathUtils.lerp(config.colorRange.sat[0], config.colorRange.sat[1], Math.random());
        const light = THREE.MathUtils.lerp(config.colorRange.light[0], config.colorRange.light[1], Math.random());
        const color = new THREE.Color().setHSL(hue, sat, light);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: config.size,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        map: particleTexture,
      });

      const points = new THREE.Points(geometry, material);
      points.userData = {
        speed: config.speed,
      };
      scene.add(points);
      particleLayers.push(points);
    }

    const clock = new THREE.Clock();
    let rafId = 0;
    let disposed = false;
    let time = 0;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      composer?.setSize(width, height);
      bloomPass?.resolution.set(width, height);
    };

    const updateParticles = (delta: number) => {
      for (const layer of particleLayers) {
        const positions = (layer.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        const speed = layer.userData.speed * (delta * 60);

        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 2] += speed;

          if (positions[i + 2] > KILL_Z) {
            positions[i + 2] = SPAWN_Z;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 140; // Fill center on recycle
            positions[i] = Math.cos(angle) * radius;
            positions[i + 1] = Math.sin(angle) * radius;
          }
        }

        layer.geometry.attributes.position.needsUpdate = true;
      }
    };

    const animate = () => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(animate);
      time += 0.01;
      const delta = clock.getDelta();
      
      updateParticles(delta);

      camera.position.x = Math.sin(time * 0.5) * 1.5;
      camera.position.y = Math.cos(time * 0.4) * 1.5;
      camera.lookAt(0, 0, -250);

      if (composer) {
        composer.render(delta);
      } else {
        renderer.render(scene, camera);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    animate();

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      particleTexture.dispose();
      for (const layer of particleLayers) {
        scene.remove(layer);
        layer.geometry.dispose();
        (layer.material as THREE.Material).dispose();
      }
      composer?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [legacyMode]);

  return (
    <div
      ref={rootRef}
      className={`w-full h-full ${className}`}
      style={{
        background:
          'radial-gradient(circle at 50% 50%, #06020e 0%, #040108 100%)',
      }}
    />
  );
});
