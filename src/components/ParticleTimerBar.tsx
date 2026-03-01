import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface ParticleTimerBarProps {
  fill: number; // 0 to 1
  color?: string;
  width: number;
  height: number;
  isPaused?: boolean;
}

export const ParticleTimerBar: React.FC<ParticleTimerBarProps> = ({
  fill,
  color = '#7fdbca',
  width,
  height,
  isPaused = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Use refs for values needed in the animation loop to avoid re-running useEffect
  const fillRef = useRef(fill);
  useEffect(() => { fillRef.current = fill; }, [fill]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -width / 2, width / 2, height / 2, -height / 2, 0.1, 1000
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const particleCount = 4000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const initialX = new Float32Array(particleCount);
    
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Distribute particles in the bar
      const x = (Math.random() - 0.5) * width;
      const y = (Math.random() - 0.5) * height;
      
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = 0;
      
      initialX[i] = x;

      colors[i3] = baseColor.r;
      colors[i3 + 1] = baseColor.g;
      colors[i3 + 2] = baseColor.b;

      sizes[i] = 1.0 + Math.random() * 2.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometryRef.current = geometry;

    const texture = createParticleTexture();
    const material = new THREE.PointsMaterial({
      size: 3,
      map: texture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false,
    });
    materialRef.current = material;

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    let time = 0;
    const animate = () => {
      if (!isPaused) time += 0.02;

      const posAttr = geometry.attributes.position;
      const sizeAttr = geometry.attributes.size;
      const currentFill = fillRef.current;
      const thresholdX = (currentFill - 0.5) * width;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const ix = initialX[i];
        
        // If particle is "beyond" the current fill line, it starts disintegrating
        if (ix > thresholdX) {
          const distancePast = ix - thresholdX;
          const life = Math.max(0, 1.0 - (distancePast / (width * 0.1))); // Short transition
          
          // Move them up and away
          positions[i3 + 1] += Math.sin(time + ix) * 0.2 + 0.1;
          positions[i3] += Math.cos(time + ix) * 0.1;
          
          sizeAttr.array[i] = sizes[i] * life;
        } else {
          // Stable particle
          positions[i3] = ix;
          positions[i3 + 1] = positions[i3 + 1] * 0.9 + ((Math.random() - 0.5) * height * 0.1) * 0.1;
          sizeAttr.array[i] = sizes[i];
        }
      }

      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [width, height, color, isPaused]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

function createParticleTexture() {
  const canvas = document.createElement('canvas');
  const size = 32;
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d')!;
  const centerX = size / 2, centerY = size / 2;
  const radius = size * 0.4;

  const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0,   'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  gradient.addColorStop(1,   'rgba(255,255,255,0)');
  
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
