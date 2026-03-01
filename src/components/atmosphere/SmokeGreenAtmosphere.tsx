import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  className?: string;
};

const PARTICLE_COUNT = 150;

function createSmokeTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture(canvas);

  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(180,255,220,0.75)');
  gradient.addColorStop(0.45, 'rgba(80,220,170,0.38)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const SmokeGreenAtmosphere = memo(function SmokeGreenAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 1, 10000);
    camera.position.z = 1000;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 0.55);
    light.position.set(-1, 0, 1);
    scene.add(light);

    const smokeTexture = createSmokeTexture();
    const smokeMaterial = new THREE.MeshLambertMaterial({
      color: 0x00dd88,
      map: smokeTexture,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const smokeGeometry = new THREE.PlaneGeometry(300, 300);
    const smokeParticles: THREE.Mesh[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const particle = new THREE.Mesh(smokeGeometry, smokeMaterial);
      particle.position.set(
        Math.random() * 500 - 250,
        Math.random() * 500 - 250,
        Math.random() * 1000 - 100,
      );
      particle.rotation.z = Math.random() * Math.PI * 2;
      scene.add(particle);
      smokeParticles.push(particle);
    }

    const clock = new THREE.Clock();
    let rafId = 0;
    let disposed = false;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(animate);
      const delta = clock.getDelta();
      for (const particle of smokeParticles) {
        particle.rotation.z += delta * 0.2;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      smokeGeometry.dispose();
      smokeMaterial.dispose();
      smokeTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        background:
          'radial-gradient(circle at 50% 50%, #123228 0%, #0b201a 35%, #060f0c 65%, #030807 100%)',
      }}
    />
  );
});

