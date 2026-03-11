import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  className?: string;
};

// Distribution helper consistent with provided JS
const getRandomRange = () => {
  const randInt = Math.floor(Math.random() * (256 - 2)) + 2;
  return (1 - Math.log(randInt) / Math.log(256)) * 500;
};

export const GravitySplitAtmosphere = memo(function GravitySplitAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 800, 1600);

    const camera = new THREE.PerspectiveCamera(35, width / height, 1, 10000);
    const cameraParams = {
      rad1: (60 * Math.PI) / 180,
      rad2: (30 * Math.PI) / 180,
      range: 1000,
    };

    const updateCameraPosition = () => {
      const x = Math.cos(cameraParams.rad1) * Math.cos(cameraParams.rad2) * cameraParams.range;
      const z = Math.cos(cameraParams.rad1) * Math.sin(cameraParams.rad2) * cameraParams.range;
      const y = Math.sin(cameraParams.rad1) * cameraParams.range;
      camera.position.set(x, y, z);
      camera.lookAt(0, 0, 0);
    };
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0x77ffaa, 0x77ffaa, 1);
    const lightRad1 = (60 * Math.PI) / 180;
    const lightRad2 = (30 * Math.PI) / 180;
    const lightRange = 1000;
    const lx = Math.cos(lightRad1) * Math.cos(lightRad2) * lightRange;
    const lz = Math.cos(lightRad1) * Math.sin(lightRad2) * lightRange;
    const ly = Math.sin(lightRad1) * lightRange;
    hemiLight.position.set(lx, ly, lz);
    scene.add(hemiLight);

    const moverCount = 50000;
    const positions = new Float32Array(moverCount * 3);
    const velocities = new Float32Array(moverCount * 3); // This acts as the movement vector (velocity in standard physics)
    const accelerations = new Float32Array(moverCount * 3); // This acts as the accumulated force
    const masses = new Float32Array(moverCount);
    const isActive = new Uint8Array(moverCount);

    const positions1 = new Float32Array((moverCount / 2) * 3);
    const positions2 = new Float32Array((moverCount / 2) * 3);

    for (let i = 0; i < moverCount; i++) {
      const range = getRandomRange();
      const rad = Math.random() * Math.PI * 2;
      const x = Math.cos(rad) * range;
      const y = 1000; // Starting off-screen
      const z = Math.sin(rad) * range;
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      // Initialize movement vectors and force vectors to zero
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
      
      accelerations[i * 3] = 0;
      accelerations[i * 3 + 1] = 0;
      accelerations[i * 3 + 2] = 0;
      
      masses[i] = (Math.random() * (500 - 300) + 300) / 100;

      // CRITICAL: Initialize the buffer arrays immediately so we don't get a bright line at 0,0,0
      const targetPos = i % 2 === 0 ? positions1 : positions2;
      const targetIdx = Math.floor(i / 2) * 3;
      targetPos[targetIdx] = x;
      targetPos[targetIdx + 1] = y;
      targetPos[targetIdx + 2] = z;
    }

    const geometry1 = new THREE.BufferGeometry();
    const geometry2 = new THREE.BufferGeometry();
    geometry1.setAttribute('position', new THREE.BufferAttribute(positions1, 3));
    geometry2.setAttribute('position', new THREE.BufferAttribute(positions2, 3));

    const material1 = new THREE.PointsMaterial({
      color: 0x77ffaa,
      size: 6,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const material2 = new THREE.PointsMaterial({
      color: 0x77aaff,
      size: 6,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const points1 = new THREE.Points(geometry1, material1);
    const points2 = new THREE.Points(geometry2, material2);
    scene.add(points1);
    scene.add(points2);

    let lastTimeActivate = Date.now();
    const antigravity = new THREE.Vector3(0, 5, 0);

    const activateMovers = () => {
      let count = 0;
      for (let i = 0; i < moverCount; i++) {
        if (isActive[i] === 0) {
          isActive[i] = 1;
          // Jump to -300 and initialize movement
          positions[i * 3 + 1] = -300;
          // Reset movement and force for the new cycle
          velocities[i * 3] = positions[i * 3];
          velocities[i * 3 + 1] = -300;
          velocities[i * 3 + 2] = positions[i * 3 + 2];
          
          accelerations[i * 3] = 0;
          accelerations[i * 3 + 1] = 0;
          accelerations[i * 3 + 2] = 0;
          
          count++;
          if (count >= 80) break;
        }
      }
    };

    let rafId: number;
    const animate = () => {
      const now = Date.now();
      if (now - lastTimeActivate > 10) {
        activateMovers();
        lastTimeActivate = now;
      }

      // Physics update
      for (let i = 0; i < moverCount; i++) {
        if (isActive[i] === 1) {
          // 1. Accumulate force (antigravity) into acceleration
          accelerations[i * 3] += antigravity.x;
          accelerations[i * 3 + 1] += antigravity.y;
          accelerations[i * 3 + 2] += antigravity.z;

          // 2. Add force/mass to velocity (movement vector)
          velocities[i * 3] += accelerations[i * 3] / masses[i];
          velocities[i * 3 + 1] += accelerations[i * 3 + 1] / masses[i];
          velocities[i * 3 + 2] += accelerations[i * 3 + 2] / masses[i];

          // 3. Update position from velocity (directly copy in original JS)
          positions[i * 3] = velocities[i * 3];
          positions[i * 3 + 1] = velocities[i * 3 + 1];
          positions[i * 3 + 2] = velocities[i * 3 + 2];

          if (positions[i * 3 + 1] > 500) {
            const range = getRandomRange();
            const rad = Math.random() * Math.PI * 2;
            const x = Math.cos(rad) * range;
            const z = Math.sin(rad) * range;
            const y = -300;
            
            // Re-init for next cycle
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            
            velocities[i * 3] = x;
            velocities[i * 3 + 1] = y;
            velocities[i * 3 + 2] = z;
            
            accelerations[i * 3] = 0;
            accelerations[i * 3 + 1] = 0;
            accelerations[i * 3 + 2] = 0;
            
            masses[i] = (Math.random() * (500 - 300) + 300) / 100;
          }
        }

        // Copy to buffer attributes
        const targetPos = i % 2 === 0 ? positions1 : positions2;
        const targetIdx = Math.floor(i / 2) * 3;
        targetPos[targetIdx] = positions[i * 3];
        targetPos[targetIdx + 1] = positions[i * 3 + 1];
        targetPos[targetIdx + 2] = positions[i * 3 + 2];
      }

      geometry1.attributes.position.needsUpdate = true;
      geometry2.attributes.position.needsUpdate = true;

      cameraParams.rad2 += 0.0035; // rotateCamera (0.2 degrees approx)
      updateCameraPosition();

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry1.dispose();
      geometry2.dispose();
      material1.dispose();
      material2.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={rootRef} className={`w-full h-full ${className}`} />;
});
