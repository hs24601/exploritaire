import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export type OceanSolarCycleConfig = {
  elevation: number;
  azimuth: number;
  exposure: number;
  sunIntensity: number;
  waterColor: string;
  distortionScale: number;
};

export const DEFAULT_OCEAN_SOLAR_CYCLE_CONFIG: OceanSolarCycleConfig = {
  elevation: 2,
  azimuth: 180,
  exposure: 0.1330,
  sunIntensity: 2.8,
  waterColor: '#70a070',
  distortionScale: 3.9
};

type Props = {
  className?: string;
  config?: OceanSolarCycleConfig;
};

export const OceanSolarCycleAtmosphere = memo(function OceanSolarCycleAtmosphere({ 
  className, 
  config = DEFAULT_OCEAN_SOLAR_CYCLE_CONFIG 
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const waterRef = useRef<Water | null>(null);
  const skyRef = useRef<Sky | null>(null);
  const sunRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 1, 20000);
    camera.position.set(30, 30, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 10, 0);
    controls.minDistance = 40.0;
    controls.maxDistance = 200.0;

    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    const water = new Water(
      waterGeometry,
      {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg', function (texture) {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        }),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
      }
    );
    water.rotation.x = -Math.PI / 2;
    scene.add(water);
    waterRef.current = water;

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);
    skyRef.current = sky;

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGeneratorRef.current = pmremGenerator;

    let rafId = 0;
    const animate = () => {
      water.material.uniforms['time'].value += 1.0 / 60.0;
      controls.update();
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
      waterGeometry.dispose();
      water.material.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !waterRef.current || !skyRef.current || !pmremGeneratorRef.current) return;

    const phi = THREE.MathUtils.degToRad(90 - config.elevation);
    const theta = THREE.MathUtils.degToRad(config.azimuth);
    sunRef.current.setFromSphericalCoords(1, phi, theta);

    skyRef.current.material.uniforms['sunPosition'].value.copy(sunRef.current);
    waterRef.current.material.uniforms['sunDirection'].value.copy(sunRef.current).normalize();

    // Create a temporary scene to generate the environment map from the sky
    const skyScene = new THREE.Scene();
    skyScene.add(skyRef.current.clone());
    sceneRef.current.environment = pmremGeneratorRef.current.fromScene(skyScene).texture;
    
    rendererRef.current.toneMappingExposure = config.exposure;
    waterRef.current.material.uniforms['sunColor'].value.setScalar(config.sunIntensity);
    waterRef.current.material.uniforms['waterColor'].value.setHex(parseInt(config.waterColor.replace('#', '0x')));
    waterRef.current.material.uniforms['distortionScale'].value = config.distortionScale;

  }, [config]);

  return <div ref={rootRef} className={`w-full h-full ${className}`} />;
});
