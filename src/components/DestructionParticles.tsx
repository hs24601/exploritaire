import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CARD_SIZE } from '../engine/constants';

interface DestructionParticlesProps {
  color?: string;
  onComplete?: () => void;
  scale?: number;
}

export const DestructionParticles: React.FC<DestructionParticlesProps> = ({
  color = '#ff4800',
  onComplete,
  scale = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = CARD_SIZE.width * scale * 2; // Extra room for explosion
    const height = CARD_SIZE.height * scale * 2;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);
    const life = new Float32Array(particleCount);

    const baseColor = new THREE.Color(color);
    const cardW = CARD_SIZE.width * scale;
    const cardH = CARD_SIZE.height * scale;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Start particles randomly on the card surface
      positions[i3] = (Math.random() - 0.5) * cardW;
      positions[i3 + 1] = (Math.random() - 0.5) * cardH;
      positions[i3 + 2] = (Math.random() - 0.5) * 5;

      // Explosion velocity
      const angle = Math.random() * Math.PI * 2;
      const force = 20 + Math.random() * 60;
      velocities[i3] = Math.cos(angle) * force;
      velocities[i3 + 1] = Math.sin(angle) * force;
      velocities[i3 + 2] = (Math.random() - 0.5) * 40;

      // Color variation
      const vColor = baseColor.clone().offsetHSL(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      );
      colors[i3] = vColor.r;
      colors[i3 + 1] = vColor.g;
      colors[i3 + 2] = vColor.b;

      sizes[i] = 1.0 + Math.random() * 2.0;
      life[i] = 1.0; // Life from 1.0 to 0.0
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const texture = createParticleTexture();
    const material = new THREE.PointsMaterial({
      size: 3.5,
      map: texture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    let startTime = performance.now();
    let animationFrame: number;

    const animate = (now: number) => {
      const delta = (now - startTime) / 1000;
      startTime = now;

      const posAttr = geometry.attributes.position;
      const sizeAttr = geometry.attributes.size;
      const colorAttr = geometry.attributes.color;

      let allDead = true;

      for (let i = 0; i < particleCount; i++) {
        if (life[i] <= 0) continue;
        allDead = false;

        const i3 = i * 3;
        
        // Update life
        life[i] -= delta * (0.3 + Math.random() * 0.5);

        // Update position
        positions[i3] += velocities[i3] * delta;
        positions[i3 + 1] += velocities[i3 + 1] * delta;
        positions[i3 + 2] += velocities[i3 + 2] * delta;

        // Add vortex effect
        const vx = positions[i3];
        const vy = positions[i3 + 1];
        const dist = Math.sqrt(vx * vx + vy * vy) + 0.1;
        const vortexStrength = 2.0 * life[i];
        velocities[i3] += (-vy / dist) * vortexStrength;
        velocities[i3 + 1] += (vx / dist) * vortexStrength;

        // Add some "gravity" or air resistance
        velocities[i3] *= 0.97;
        velocities[i3 + 1] *= 0.97;
        velocities[i3 + 2] *= 0.97;

        // Update size
        sizeAttr.array[i] = sizes[i] * Math.pow(life[i], 0.5) * 2.0;
        
        // Fade out color
        const fade = Math.pow(life[i], 1.5);
        colorAttr.array[i3] = colors[i3] * fade;
        colorAttr.array[i3 + 1] = colors[i3 + 1] * fade;
        colorAttr.array[i3 + 2] = colors[i3 + 2] * fade;
      }

      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      renderer.render(scene, camera);

      if (allDead) {
        if (onComplete) onComplete();
      } else {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [color, onComplete, scale]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none flex items-center justify-center z-[1000]">
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: CARD_SIZE.width * scale * 2, 
          height: CARD_SIZE.height * scale * 2,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }} 
      />
    </div>
  );
};

function createParticleTexture() {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d')!;
  const centerX = size / 2, centerY = size / 2;
  const outerRadius = size * 0.45;

  const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
  gradient.addColorStop(0,   'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(1,   'rgba(255,255,255,0)');
  
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
