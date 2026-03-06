import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

export type FallingSnowConfig = {
  particleCount: number;
  fallSpeed: number;
  windX: number;
  windZ: number;
  particleSize: number;
  color: string;
  opacity: number;
  areaSize: number;
};

export const DEFAULT_FALLING_SNOW_CONFIG: FallingSnowConfig = {
  particleCount: 1000,
  fallSpeed: 2.5,
  windX: 0.5,
  windZ: 0.2,
  particleSize: 8,
  color: "#ffffff",
  opacity: 0.8,
  areaSize: 2000
};

type Props = {
  className?: string;
  config?: FallingSnowConfig;
};

export const FallingSnowAtmosphere = memo(function FallingSnowAtmosphere({ 
  className, 
  config = DEFAULT_FALLING_SNOW_CONFIG 
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 1, 10000);
    camera.position.z = 1000;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Create Geometry
    const geometry = new THREE.BufferGeometry();
    geometryRef.current = geometry;
    
    const positions = new Float32Array(config.particleCount * 3);
    for (let i = 0; i < config.particleCount; i++) {
      positions[i * 3] = Math.random() * config.areaSize - config.areaSize / 2;
      positions[i * 3 + 1] = Math.random() * config.areaSize - config.areaSize / 2;
      positions[i * 3 + 2] = Math.random() * config.areaSize - config.areaSize / 2;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Create Material
    const textureLoader = new THREE.TextureLoader();
    const snowflakeTexture = textureLoader.load('https://s3-us-west-2.amazonaws.com/s.cdpn.io/82015/snowflake.png');

    const material = new THREE.PointsMaterial({
      size: config.particleSize,
      map: snowflakeTexture,
      transparent: true,
      opacity: config.opacity,
      color: new THREE.Color(config.color),
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    materialRef.current = material;

    const points = new THREE.Points(geometry, material);
    pointsRef.current = points;
    scene.add(points);

    let rafId = 0;
    const animate = () => {
      const positions = geometry.attributes.position.array as Float32Array;
      const halfSize = config.areaSize / 2;

      for (let i = 0; i < config.particleCount; i++) {
        // Update Y (Fall)
        positions[i * 3 + 1] -= config.fallSpeed;
        if (positions[i * 3 + 1] < -halfSize) positions[i * 3 + 1] += config.areaSize;

        // Update X (Wind)
        positions[i * 3] += config.windX;
        if (positions[i * 3] > halfSize) positions[i * 3] -= config.areaSize;
        else if (positions[i * 3] < -halfSize) positions[i * 3] += config.areaSize;

        // Update Z (Drift)
        positions[i * 3 + 2] += config.windZ;
        if (positions[i * 3 + 2] > halfSize) positions[i * 3 + 2] -= config.areaSize;
        else if (positions[i * 3 + 2] < -halfSize) positions[i * 3 + 2] += config.areaSize;
      }
      
      geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(rafId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [config.particleCount, config.areaSize]);

  // Handle updates to material properties
  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.size = config.particleSize;
    materialRef.current.opacity = config.opacity;
    materialRef.current.color.set(config.color);
  }, [config.particleSize, config.opacity, config.color]);

  return <div ref={rootRef} className={`w-full h-full ${className}`} />;
});
