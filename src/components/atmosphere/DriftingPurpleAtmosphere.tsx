import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

type Props = {
  className?: string;
};

type LayerConfig = {
  count: number;
  size: number;
  colorRange: { hue: [number, number]; sat: [number, number]; light: [number, number] };
  rotationSpeed: number;
};

type Ripple = {
  x: number;
  y: number;
  radius: number;
  strength: number;
  maxRadius: number;
  speed: number;
  color: THREE.Color;
};

const LAYERS: LayerConfig[] = [
  {
    count: 20000,
    size: 0.3,
    colorRange: { hue: [0.75, 0.9], sat: [0.7, 1], light: [0.5, 0.7] },
    rotationSpeed: 0.001,
  },
  {
    count: 25000,
    size: 0.2,
    colorRange: { hue: [0.45, 0.6], sat: [0.6, 0.8], light: [0.4, 0.6] },
    rotationSpeed: 0.0005,
  },
];

const MOUSE_RADIUS = 20;
const ENABLE_IDLE_DRIFT = false;

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

export const DriftingPurpleAtmosphere = memo(function DriftingPurpleAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020108, 0.008);
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x020108, 0);
    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.2, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.radius = 0.5;
    composer.addPass(bloomPass);

    const particleTexture = createParticleTexture();
    const particleLayers: THREE.Points[] = [];
    let ripples: Ripple[] = [];

    for (const config of LAYERS) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(config.count * 3);
      const colors = new Float32Array(config.count * 3);
      const basePositions = new Float32Array(config.count * 3);
      const baseColors = new Float32Array(config.count * 3);
      const velocities = new Float32Array(config.count * 3);
      const colorVelocities = new Float32Array(config.count * 3);

      for (let i = 0; i < config.count; i += 1) {
        const i3 = i * 3;
        const radius = 10 + Math.random() * 100;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;

        const dist = Math.sqrt(x * x + y * y + z * z) / 110;
        const hue = THREE.MathUtils.lerp(config.colorRange.hue[0], config.colorRange.hue[1], dist);
        const sat = THREE.MathUtils.lerp(config.colorRange.sat[0], config.colorRange.sat[1], dist);
        const light = THREE.MathUtils.lerp(config.colorRange.light[0], config.colorRange.light[1], dist);
        const color = new THREE.Color().setHSL(hue, sat, light);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
        baseColors[i3] = color.r;
        baseColors[i3 + 1] = color.g;
        baseColors[i3 + 2] = color.b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: config.size,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        map: particleTexture,
      });

      const points = new THREE.Points(geometry, material);
      points.userData = {
        velocities,
        basePositions,
        baseColors,
        colorVelocities,
        rotationSpeed: config.rotationSpeed,
      };
      scene.add(points);
      particleLayers.push(points);
    }

    const pointerCurrent = new THREE.Vector3();
    const pointerTarget = new THREE.Vector3();
    const clock = new THREE.Clock();
    let rafId = 0;
    let disposed = false;
    let time = 0;

    const worldFromClient = (clientX: number, clientY: number, out: THREE.Vector3) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      const vector = new THREE.Vector3(nx, ny, 0.5);
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      out.copy(camera.position).add(dir.multiplyScalar(distance));
    };

    const inBounds = (event: { clientX: number; clientY: number }) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!inBounds(event)) return;
      worldFromClient(event.clientX, event.clientY, pointerTarget);
    };

    const onClick = (event: MouseEvent) => {
      if (!inBounds(event)) return;
      const point = new THREE.Vector3();
      worldFromClient(event.clientX, event.clientY, point);
      ripples.push({
        x: point.x,
        y: point.y,
        radius: 0,
        strength: 2.5,
        maxRadius: MOUSE_RADIUS * 4,
        speed: 4,
        color: new THREE.Color(0xffffff),
      });
    };

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
    };

    const updateParticles = () => {
      pointerCurrent.lerp(pointerTarget, 0.05);
      ripples = ripples.filter((ripple) => {
        ripple.radius += ripple.speed;
        ripple.strength *= 0.96;
        return ripple.radius < ripple.maxRadius;
      });

      for (const layer of particleLayers) {
        const positions = (layer.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        const colors = (layer.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
        const { velocities, basePositions, baseColors, colorVelocities } = layer.userData as {
          velocities: Float32Array;
          basePositions: Float32Array;
          baseColors: Float32Array;
          colorVelocities: Float32Array;
        };

        for (let i = 0; i < positions.length; i += 3) {
          const px = positions[i];
          const py = positions[i + 1];
          const pz = positions[i + 2];
          const particle = new THREE.Vector3(px, py, pz);
          const force = new THREE.Vector3();
          const colorShift = new THREE.Vector3();

          const mouseDist = particle.distanceTo(pointerCurrent);
          if (mouseDist < MOUSE_RADIUS) {
            const strength = (1 - mouseDist / MOUSE_RADIUS) * 0.1;
            force.add(particle.clone().sub(pointerCurrent).normalize().multiplyScalar(strength));
            const colorIntensity = (1 - mouseDist / MOUSE_RADIUS) * 0.8;
            colorShift.set(colorIntensity, colorIntensity, colorIntensity);
          }

          for (const ripple of ripples) {
            const rippleDist = Math.hypot(ripple.x - px, ripple.y - py);
            const rippleWidth = 15;
            if (Math.abs(rippleDist - ripple.radius) < rippleWidth) {
              const falloff = 1 - Math.abs(rippleDist - ripple.radius) / rippleWidth;
              const rippleForce = ripple.strength * falloff * 0.1;
              const dir = particle.clone().sub(new THREE.Vector3(ripple.x, ripple.y, pz)).normalize();
              force.add(dir.multiplyScalar(rippleForce));
              colorShift.add(new THREE.Vector3(ripple.color.r, ripple.color.g, ripple.color.b).multiplyScalar(falloff * ripple.strength));
            }
          }

          velocities[i] += force.x;
          velocities[i + 1] += force.y;
          velocities[i + 2] += force.z;
          velocities[i] += (basePositions[i] - px) * 0.02;
          velocities[i + 1] += (basePositions[i + 1] - py) * 0.02;
          velocities[i + 2] += (basePositions[i + 2] - pz) * 0.02;
          velocities[i] *= 0.94;
          velocities[i + 1] *= 0.94;
          velocities[i + 2] *= 0.94;
          positions[i] += velocities[i];
          positions[i + 1] += velocities[i + 1];
          positions[i + 2] += velocities[i + 2];

          colorVelocities[i] += colorShift.x;
          colorVelocities[i + 1] += colorShift.y;
          colorVelocities[i + 2] += colorShift.z;
          colorVelocities[i] += (baseColors[i] - colors[i]) * 0.05;
          colorVelocities[i + 1] += (baseColors[i + 1] - colors[i + 1]) * 0.05;
          colorVelocities[i + 2] += (baseColors[i + 2] - colors[i + 2]) * 0.05;
          colorVelocities[i] *= 0.9;
          colorVelocities[i + 1] *= 0.9;
          colorVelocities[i + 2] *= 0.9;
          colors[i] += colorVelocities[i];
          colors[i + 1] += colorVelocities[i + 1];
          colors[i + 2] += colorVelocities[i + 2];
        }

        layer.geometry.attributes.position.needsUpdate = true;
        layer.geometry.attributes.color.needsUpdate = true;
      }
    };

    const animate = () => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(animate);
      time += 0.01;
      const delta = clock.getDelta();
      updateParticles();
      for (const layer of particleLayers) {
        if (ENABLE_IDLE_DRIFT) {
          const speed = (layer.userData as { rotationSpeed: number }).rotationSpeed;
          layer.rotation.y += speed;
          layer.rotation.x = Math.sin(time * 0.1) * 0.05;
        }
      }
      if (ENABLE_IDLE_DRIFT) {
        camera.position.x = Math.sin(time * 0.2) * 2;
        camera.position.y = Math.cos(time * 0.3) * 2;
      } else {
        camera.position.x = 0;
        camera.position.y = 0;
      }
      camera.lookAt(scene.position);
      composer.render(delta);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('click', onClick);
    animate();

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('click', onClick);
      particleTexture.dispose();
      for (const layer of particleLayers) {
        scene.remove(layer);
        layer.geometry.dispose();
        (layer.material as THREE.Material).dispose();
      }
      composer.dispose();
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
          'radial-gradient(circle at 50% 50%, #1a0632 0%, #140426 25%, #0c021a 50%, #06020e 75%, #020108 100%)',
      }}
    />
  );
});
