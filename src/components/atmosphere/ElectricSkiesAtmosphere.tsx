import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

// Local copy of the smoke texture — avoids CORS issues with the original CDN URL.
const CLOUD_TEXTURE_PATH = '/assets/cloud-smoke.png';

export type ElectricSkiesConfig = {
  rainCount: number;
  cloudCount: number;
  flashFrequency: number;
  flashIntensity: number;
  rainOpacity: number;
  rainSpeed: number;
  cloudOpacity: number;
};

export const DEFAULT_ELECTRIC_SKIES_CONFIG: ElectricSkiesConfig = {
  rainCount: 15000,
  cloudCount: 25,
  flashFrequency: 0.07, 
  flashIntensity: 15000, 
  rainOpacity: 1.0,
  rainSpeed: 0.222,
  cloudOpacity: 1.0,
};

type Props = {
  className?: string;
  config?: ElectricSkiesConfig;
};

export const ElectricSkiesAtmosphere = memo(function ElectricSkiesAtmosphere({
  className,
  config = DEFAULT_ELECTRIC_SKIES_CONFIG
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      1,
      1000
    );
    camera.position.z = 1;
    camera.rotation.x = 1.16;
    camera.rotation.y = -0.12;
    camera.rotation.z = 0.27;

    const ambient = new THREE.AmbientLight(0x555555);
    scene.add(ambient);

    const directionalLight = new THREE.DirectionalLight(0xffeedd);
    directionalLight.position.set(0, 0, 1);
    scene.add(directionalLight);

    // THREE r170 uses physical lighting (1/d^decay).  The sandbox ran legacy
    // THREE where falloff was (1-d/cutoff)^decay — ~3400× brighter at typical
    // cloud distances.  Compensate: decay 1→1 (linear, gentler), and scale all
    // power values by LIGHT_SCALE so the flash visibly illuminates cloud clusters.
    const LIGHT_SCALE = 250;
    const flash = new THREE.PointLight(0x062d89, 30 * LIGHT_SCALE, 800, 1);
    flash.position.set(200, 300, 100);
    scene.add(flash);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const fog = new THREE.FogExp2(0x11111f, 0.002);
    scene.fog = fog;
    renderer.setClearColor(fog.color);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Rain
    const rainCount = config.rainCount;
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      positions[i * 3]     = Math.random() * 400 - 200;
      positions[i * 3 + 1] = Math.random() * 500 - 250;
      positions[i * 3 + 2] = Math.random() * 400 - 200;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rainMaterial = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.1,
      transparent: true,
      opacity: config.rainOpacity
    });
    const rain = new THREE.Points(rainGeo, rainMaterial);
    scene.add(rain);

    // Clouds
    const cloudParticles: THREE.Mesh[] = [];
    let cloudGeo: THREE.PlaneGeometry | null = null;
    let cloudMat: THREE.MeshLambertMaterial | null = null;
    let cloudTexture: THREE.Texture | null = null;

    const loader = new THREE.TextureLoader();
    loader.load(CLOUD_TEXTURE_PATH, (texture) => {
      if (disposed) return;
      cloudTexture = texture;
      cloudGeo = new THREE.PlaneGeometry(500, 500);
      cloudMat = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: true,
        opacity: config.cloudOpacity,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      for (let p = 0; p < config.cloudCount; p++) {
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.position.set(
          Math.random() * 800 - 400,
          500,
          Math.random() * 500 - 450
        );
        cloud.rotation.x = 1.16;
        cloud.rotation.y = -0.12;
        cloud.rotation.z = Math.random() * 360;
        cloudParticles.push(cloud);
        scene.add(cloud);
      }
    });

    let rafId = 0;
    let disposed = false;

    const animate = () => {
      if (disposed) return;

      cloudParticles.forEach((p) => {
        p.rotation.z -= 0.002;
      });

      rain.position.z -= config.rainSpeed;
      if (rain.position.z < -200) {
        rain.position.z = 0;
      }

      // Same sustain logic as the sandbox: raw power [50–550], sustain while >100.
      // All power values are scaled by LIGHT_SCALE for physical-mode visibility,
      // and thresholds are scaled to match so the probability distribution
      // (80 % sustain, 20 % cutoff) is identical to the original.
      const scaledThreshold = 100 * LIGHT_SCALE;
      if (Math.random() > 0.93 || flash.power > scaledThreshold) {
        if (flash.power < scaledThreshold) {
          flash.position.set(
            Math.random() * 400,
            300 + Math.random() * 200,
            100
          );
        }
        flash.power = (50 + Math.random() * 500) * LIGHT_SCALE;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      rainGeo.dispose();
      rainMaterial.dispose();
      cloudGeo?.dispose();
      cloudMat?.dispose();
      cloudTexture?.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [config]);

  return <div ref={rootRef} className={`w-full h-full ${className ?? ''}`} />;
});
