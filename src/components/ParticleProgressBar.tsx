import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface ParticleProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  orientation?: 'horizontal' | 'vertical';
  isPaused?: boolean;
  className?: string;
}

export const ParticleProgressBar: React.FC<ParticleProgressBarProps> = ({
  progress,
  color = '#ff8a00',
  orientation = 'horizontal',
  isPaused = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const progressRef = useRef(progress);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const { width, height } = dimensions;
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

    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const initialPos = new Float32Array(particleCount * 2); 
    
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const i2 = i * 2;
      
      const x = (Math.random() - 0.5) * width;
      const y = (Math.random() - 0.5) * height;
      
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = 0;
      
      initialPos[i2] = x;
      initialPos[i2 + 1] = y;

      colors[i3] = baseColor.r;
      colors[i3 + 1] = baseColor.g;
      colors[i3 + 2] = baseColor.b;

      sizes[i] = 1.2 + Math.random() * 2.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const texture = createParticleTexture();
    const material = new THREE.PointsMaterial({
      size: 4,
      map: texture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    let time = 0;
    const animate = () => {
      if (!isPaused) time += 0.02;

      const posAttr = geometry.attributes.position;
      const sizeAttr = geometry.attributes.size;
      const colorAttr = geometry.attributes.color;
      const currentProgress = progressRef.current;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const i2 = i * 2;
        const ix = initialPos[i2];
        const iy = initialPos[i2 + 1];
        
        let isActive = false;
        let distPast = 0;

        if (orientation === 'horizontal') {
          const threshold = (currentProgress - 0.5) * width;
          isActive = ix <= threshold;
          distPast = ix - threshold;
        } else {
          const threshold = (currentProgress - 0.5) * height;
          isActive = iy <= threshold;
          distPast = iy - threshold;
        }

        if (isActive) {
          positions[i3] = ix + Math.sin(time + iy) * 0.2;
          positions[i3 + 1] = iy + Math.cos(time + ix) * 0.2;
          sizeAttr.array[i] = sizes[i];
          
          colorAttr.array[i3] = baseColor.r;
          colorAttr.array[i3 + 1] = baseColor.g;
          colorAttr.array[i3 + 2] = baseColor.b;
        } else {
          const life = Math.max(0, 1.0 - (distPast / (orientation === 'horizontal' ? width * 0.2 : height * 0.2)));
          
          if (orientation === 'horizontal') {
            positions[i3 + 1] += Math.sin(time * 0.5 + ix) * 0.5 + 0.2;
            positions[i3] += Math.cos(time * 0.5 + iy) * 0.2;
          } else {
            positions[i3] += Math.sin(time * 0.5 + iy) * 0.5 + 0.2;
            positions[i3 + 1] += Math.cos(time * 0.5 + ix) * 0.2;
          }
          
          sizeAttr.array[i] = sizes[i] * Math.pow(life, 0.5);
          colorAttr.array[i3] = baseColor.r * life;
          colorAttr.array[i3 + 1] = baseColor.g * life;
          colorAttr.array[i3 + 2] = baseColor.b * life;
        }
      }

      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

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
  }, [dimensions, color, isPaused, orientation]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
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
