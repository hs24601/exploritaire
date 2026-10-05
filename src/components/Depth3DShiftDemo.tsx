import { memo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AuroraForestAtmosphere } from './atmosphere/AuroraForestAtmosphere';
import { GargantuaAtmosphere } from './atmosphere/GargantuaAtmosphere';
import { BrownianMotionAtmosphere } from './atmosphere/BrownianMotionAtmosphere';
import { ChaosSplitAtmosphere } from './atmosphere/ChaosSplitAtmosphere';
import { CometBarrageAtmosphere } from './atmosphere/CometBarrageAtmosphere';
import { CometRainAtmosphere, DEFAULT_COMET_RAIN_CONFIG } from './atmosphere/CometRainAtmosphere';
import { CosmicLintAtmosphere, DEFAULT_COSMIC_LINT_CONFIG } from './atmosphere/CosmicLintAtmosphere';
import { DoorSandsTimeAtmosphere } from './atmosphere/DoorSandsTimeAtmosphere';
import { DriftingPurpleAtmosphere } from './atmosphere/DriftingPurpleAtmosphere';
import { EinsteinRosenAtmosphere } from './atmosphere/EinsteinRosenAtmosphere';
import { ElectricSkiesAtmosphere, DEFAULT_ELECTRIC_SKIES_CONFIG } from './atmosphere/ElectricSkiesAtmosphere';
import { RagingWavesAtmosphere, DEFAULT_RAGING_WAVES_CONFIG } from './atmosphere/RagingWavesAtmosphere';
import { FallingSnowAtmosphere, DEFAULT_FALLING_SNOW_CONFIG } from './atmosphere/FallingSnowAtmosphere';
import { FlorpusForestAtmosphere } from './atmosphere/FlorpusForestAtmosphere';
import { GravitySplitAtmosphere } from './atmosphere/GravitySplitAtmosphere';
import { InfernoMaelstromAtmosphere } from './atmosphere/InfernoMaelstromAtmosphere';
import { OceanSolarCycleAtmosphere, DEFAULT_OCEAN_SOLAR_CYCLE_CONFIG } from './atmosphere/OceanSolarCycleAtmosphere';
import { LostInStarsAtmosphere } from './atmosphere/LostInStarsAtmosphere';
import { RaritySquaresTunnelAtmosphere } from './atmosphere/RaritySquaresTunnelAtmosphere';
import { SacredRealmAtmosphere } from './atmosphere/SacredRealmAtmosphere';
import { SakuraBlossomsAtmosphere } from './atmosphere/SakuraBlossomsAtmosphere';
import { SmokeGreenAtmosphere } from './atmosphere/SmokeGreenAtmosphere';
import { SolarisPrimeAtmosphere } from './atmosphere/SolarisPrimeAtmosphere';
import type { AtmosphereEffectId } from './atmosphere/atmosphereLibrary';

export type Depth3DBackgroundId = 'stars' | AtmosphereEffectId;

export type Depth3DShiftConfig = {
  backgroundType: Depth3DBackgroundId;
  orbitMaxAngleXDeg: number;
  orbitMaxAngleYDeg: number;
  rotationSmoothing: number;
  cameraZ: number;
  lookAtZ: number;
  orbitRadius: number;
  cardTiltXDeg: number;
  cardTiltYDeg: number;
  cardTranslateX: number;
  cardTranslateY: number;
  contentParallaxX: number;
  contentParallaxY: number;
  starCount: number;
  starSize: number;
};

export const DEFAULT_DEPTH_3D_SHIFT_CONFIG: Depth3DShiftConfig = {
  backgroundType: 'stars',
  orbitMaxAngleXDeg: 15,
  orbitMaxAngleYDeg: 15,
  rotationSmoothing: 0.05,
  cameraZ: 15,
  lookAtZ: -20,
  orbitRadius: 5,
  cardTiltXDeg: 10,
  cardTiltYDeg: 10,
  cardTranslateX: 0.3,
  cardTranslateY: 0.3,
  contentParallaxX: 0.02,
  contentParallaxY: 0.02,
  starCount: 4000,
  starSize: 0.08
};

type Props = {
  config?: Depth3DShiftConfig;
};

export const Depth3DShiftDemo = memo(function Depth3DShiftDemo({
  config = DEFAULT_DEPTH_3D_SHIFT_CONFIG
}: Props) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [gyroPermission, setGyroPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const sceneRef = useRef<THREE.Scene | undefined>(undefined);
  const cameraRef = useRef<THREE.PerspectiveCamera | undefined>(undefined);
  const rendererRef = useRef<THREE.WebGLRenderer | undefined>(undefined);
  const starsRef = useRef<THREE.Points | undefined>(undefined);

  // Mouse/gyro tracking — runs once, updates both state (for CSS) and ref (for Three.js loop)
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

    const handleMouseMove = (event: MouseEvent) => {
      const pos = { x: event.pageX, y: event.pageY };
      setMousePos(pos);
      mousePosRef.current = pos;
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      const wWidth = window.innerWidth;
      const wHeight = window.innerHeight;
      const beta = Math.min(Math.max(event.beta, -30), 30);
      const gamma = Math.min(Math.max(event.gamma, -30), 30);
      const pos = {
        x: ((gamma + 30) / 60) * wWidth,
        y: ((beta + 30) / 60) * wHeight
      };
      setMousePos(pos);
      mousePosRef.current = pos;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // Three.js setup — only re-runs when config changes, not on every mouse move
  useEffect(() => {
    if (config.backgroundType !== 'stars' || !canvasRef.current) return;

    const width = 320;
    const height = 480;
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = config.cameraZ;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.starCount * 3);
    const colors = new Float32Array(config.starCount * 3);

    for (let i = 0; i < config.starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 20;

      const r = 0.4 + Math.random() * 0.6;
      const g = 0.7 + Math.random() * 0.3;
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: config.starSize,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const stars = new THREE.Points(geometry, material);
    starsRef.current = stars;
    scene.add(stars);

    const animate = () => {
      if (starsRef.current) {
        starsRef.current.rotation.y += 0.0005;
      }

      if (cameraRef.current) {
        const mp = mousePosRef.current;
        const maxRadX = (config.orbitMaxAngleXDeg * Math.PI) / 180;
        const maxRadY = (config.orbitMaxAngleYDeg * Math.PI) / 180;
        const targetRotY = (mp.x / window.innerWidth - 0.5) * -2 * maxRadY;
        const targetRotX = (mp.y / window.innerHeight - 0.5) * -2 * maxRadX;

        const targetX = Math.sin(targetRotY) * config.orbitRadius;
        const targetY = Math.sin(-targetRotX) * config.orbitRadius;

        cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * config.rotationSmoothing;
        cameraRef.current.position.y += (targetY - cameraRef.current.position.y) * config.rotationSmoothing;
        cameraRef.current.lookAt(0, 0, config.lookAtZ);
      }

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      sceneRef.current = undefined;
      cameraRef.current = undefined;
      rendererRef.current = undefined;
      starsRef.current = undefined;
    };
  }, [config]);

  const requestPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        setGyroPermission(response === 'granted' ? 'granted' : 'denied');
      } catch (error) {
        setGyroPermission('denied');
      }
    } else {
      setGyroPermission('granted');
    }
  };

  const wWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const wHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

  const mouseFromCenterX = mousePos.x - (wWidth / 2);
  const mouseFromCenterY = mousePos.y - (wHeight / 2);

  const normX = mousePos.x / wWidth - 0.5;
  const normY = mousePos.y / wHeight - 0.5;
  const around1 = -2 * normY * config.cardTiltXDeg;
  const around2 = 2 * normX * config.cardTiltYDeg;
  const trans1 = (mousePos.x * 100 / wHeight * config.cardTranslateX);
  const trans2 = (mousePos.y * 100 / wHeight * config.cardTranslateY);

  const dy = mousePos.y - wHeight / 2;
  const dx = mousePos.x - wWidth / 2;
  const theta = Math.atan2(dy, dx);
  const angle = theta * 180 / Math.PI - 90;
  const shineOpacity = (mousePos.y / wHeight) * 0.7;

  const renderBackground = () => {
    switch (config.backgroundType) {
      case 'none':
        return <div className="w-full h-full bg-black" />;
      case 'stars':
        return <canvas ref={canvasRef} className="w-full h-full block" />;
      case 'aurora_forest':
        return <AuroraForestAtmosphere />;
      case 'gargantua':
        return <GargantuaAtmosphere />;
      case 'brownian_motion':
        return <BrownianMotionAtmosphere />;
      case 'chaos_split':
        return <ChaosSplitAtmosphere />;
      case 'comet_barrage':
        return <CometBarrageAtmosphere />;
      case 'comet_rain':
        return <CometRainAtmosphere config={DEFAULT_COMET_RAIN_CONFIG} />;
      case 'cosmic_lint':
        return <CosmicLintAtmosphere config={DEFAULT_COSMIC_LINT_CONFIG} />;
      case 'door_sands_time':
        return <DoorSandsTimeAtmosphere />;
      case 'drifting_purple':
        return <DriftingPurpleAtmosphere />;
      case 'einstein_rosen':
        return <EinsteinRosenAtmosphere />;
      case 'electric_skies':
        return <ElectricSkiesAtmosphere config={DEFAULT_ELECTRIC_SKIES_CONFIG} />;
      case 'falling_snow':
        return <FallingSnowAtmosphere config={DEFAULT_FALLING_SNOW_CONFIG} />;
      case 'florpus_forest':
        return <FlorpusForestAtmosphere />;
      case 'gravity_split':
        return <GravitySplitAtmosphere />;
      case 'inferno_maelstrom':
        return <InfernoMaelstromAtmosphere />;
      case 'lost_in_stars':
        return <LostInStarsAtmosphere />;
      case 'ocean_solar_cycle':
        return <OceanSolarCycleAtmosphere config={DEFAULT_OCEAN_SOLAR_CYCLE_CONFIG} />;
      case 'raging_waves':
        return <RagingWavesAtmosphere config={DEFAULT_RAGING_WAVES_CONFIG} />;
      case 'rarity_squares_tunnel':
        return <RaritySquaresTunnelAtmosphere />;
      case 'sacred_realm':
        return <SacredRealmAtmosphere />;
      case 'sakura_blossoms':
        return <SakuraBlossomsAtmosphere />;
      case 'smoke_green':
        return <SmokeGreenAtmosphere />;
      case 'solaris_prime':
        return <SolarisPrimeAtmosphere />;
      default:
        return <div className="w-full h-full bg-black" />;
    }
  };

  return (
    <div className="depth-3d-shift-container h-full w-full flex items-center justify-center overflow-hidden" style={{ perspective: '1000px', backgroundColor: '#020205' }}>
      <style>{`
        @font-face {
          font-family: 'Roboto Local';
          src: url('/assets/vis/fonts/roboto-0.ttf') format('truetype');
          font-display: swap;
          font-weight: 400;
        }
        @font-face {
          font-family: 'Roboto Local';
          src: url('/assets/vis/fonts/roboto-1.ttf') format('truetype');
          font-display: swap;
          font-weight: 700;
        }
        .d3s-wrap { position: relative; width: 320px; height: 480px; transform-style: preserve-3d; }
        .d3s-card {
          position: absolute; inset: 0; border-radius: 24px; background: #000; z-index: 1;
          transform-style: preserve-3d; box-shadow: 0 30px 60px rgba(0,0,0,0.8); overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .d3s-content-layer {
          position: absolute; inset: -40px; width: calc(100% + 80px); height: calc(100% + 80px);
          z-index: 0; pointer-events: none;
        }
        .d3s-card-front {
          position: absolute; inset: 0; z-index: 5; transform-style: preserve-3d;
          background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 100%); pointer-events: none;
        }
        .d3s-card-title {
          position: absolute; color: #FFF; font-weight: 700; text-align: left; left: 30px; bottom: 100px;
          font-size: 32px; line-height: 1; text-shadow: 0 4px 20px rgba(0,0,0,0.9); width: 80%; margin: 0;
          transform-style: preserve-3d; font-family: 'Roboto Local', sans-serif;
        }
        .d3s-card-subtitle {
          position: absolute; color: rgba(0,255,255,0.9); font-weight: 400; text-align: left; left: 30px;
          width: 80%; bottom: 65px; font-size: 16px; letter-spacing: 0.2em; text-transform: uppercase;
          text-shadow: 0 2px 10px rgba(0,0,0,0.9); transform-style: preserve-3d; font-family: 'Roboto Local', sans-serif;
        }
        .d3s-card-shadow {
          position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, rgba(0,200,255,0.15) 0%, transparent 70%);
          z-index: -1; filter: blur(40px); transform: translateZ(-50px);
        }
      `}</style>

      <div className="d3s-wrap">
        <div
          className="d3s-card-shadow"
          style={{ transform: `scale(1.2) translateX(${(mouseFromCenterX * -0.01)}px) translateY(${(mouseFromCenterY * -0.01)}px) translateZ(-50px)` }}
        />

        <div
          className="d3s-card"
          style={{ transform: `translate3d(${trans1}px, ${trans2}px, 0) rotateX(${around1}deg) rotateY(${around2}deg)` }}
        >
          <div
            className="d3s-content-layer"
            style={{ transform: `translateX(${mouseFromCenterX * -config.contentParallaxX}px) translateY(${mouseFromCenterY * -config.contentParallaxY}px)` }}
          >
            {renderBackground()}
          </div>

          <div className="d3s-card-front">
            <h3
              className="d3s-card-title"
              style={{ transform: `translateX(${(mouseFromCenterX / 12) * 0.5}px) translateY(${(mouseFromCenterY / 12) * 0.5}px) translateZ(50px)` }}
            >
              {config.backgroundType.toUpperCase()} DEPTH
            </h3>
            <p
              className="d3s-card-subtitle"
              style={{ transform: `translateX(${(mouseFromCenterX / 12) * 0.3}px) translateY(${(mouseFromCenterY / 12) * 0.3}px) translateZ(80px)` }}
            >
              3D Volume Shift
            </p>
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{ background: `linear-gradient(${angle}deg, rgba(255,255,255,${shineOpacity * 0.4}) 0%, rgba(255,255,255,0) 80%)` }}
            />
          </div>
        </div>
      </div>

      {isMobile && gyroPermission === 'prompt' && (
        <button
          onClick={requestPermission}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-2 bg-game-gold text-black font-black text-[10px] uppercase tracking-widest rounded-full shadow-xl animate-pulse z-[100]"
        >
          Enable 3D Depth
        </button>
      )}
    </div>
  );
});
