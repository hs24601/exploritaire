import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand } from '../components/Hand';
import { Card } from '../components/Card';
import { DragPreview } from '../components/DragPreview';
import { useImmersiveBattle } from '../contexts/ImmersiveBattleContext';
import { useDragDrop } from '../hooks/useDragDrop';
import type { Card as CardType, Actor } from '../engine/types';
import { createActor } from '../engine/actors';
import { createActorFoundationCard } from '../engine/combat/foundationCard';
import { FoundationActor } from '../components/FoundationActor';
import { WatercolorStormyEffect, DEFAULT_WATERCOLOR_STORMY_CONFIG } from '../components/active/WatercolorStormyEffect';
import { getActorDefinition } from '../engine/actors';

// Effects Library
import { SparksPericulumEffect } from '../components/active/SparksPericulumEffect';
import { LocalizedBlackHoleEffect } from '../components/active/LocalizedBlackHoleEffect';
import { CosmicNeutronBarrageEffect } from '../components/active/CosmicNeutronBarrageEffect';
import { ChaosAtmosphereEffect } from '../components/active/ChaosAtmosphereEffect';
import { GodRaysEffect } from '../components/active/GodRaysEffect';
import { GommageEffect } from '../components/active/GommageEffect';
import { SpawnNaviEffect } from '../components/active/SpawnNaviEffect';
import { BatFlyEffect } from '../components/active/BatFlyEffect';
import { FlowerFallEffect } from '../components/active/FlowerFallEffect';
import { OsmosBubbleEffect } from '../components/active/OsmosBubbleEffect';
import { ConfettiFallEffect } from '../components/active/ConfettiFallEffect';
import { ChaosAtmosphereConfig, DEFAULT_CHAOS_ATMOSPHERE_CONFIG } from '../components/active/ChaosAtmosphereEffect';
import { StarsTwinklePerformantAtmosphere, DEFAULT_STARS_TWINKLE_CONFIG } from '../components/atmosphere/StarsTwinklePerformantAtmosphere';

const ENEMY_CHAOS_CONFIG: ChaosAtmosphereConfig = {
  ...DEFAULT_CHAOS_ATMOSPHERE_CONFIG,
  scale: 6.3,
  timeScale: 0.001,
  opacity: 0.9,
};

type ImmersiveAtmosphereMode = 'none' | 'stars_twinkle_performant';

const ATMOSPHERE_CYCLE: ImmersiveAtmosphereMode[] = [
  'none',
  'stars_twinkle_performant',
];
import { HyperWispEffect } from '../components/active/HyperWispEffect';
import { SuperNovaEffect } from '../components/active/SuperNovaEffect';
import { TopoRainbowEffect } from '../components/active/TopoRainbowEffect';

const ABILITY_CARDS: CardType[] = [
  { id: 'rpg-bite', rank: 1, suit: '🔥', element: 'F', name: 'Bite', rpgAbilityId: 'bite' },
  { id: 'rpg-ironfur', rank: 2, suit: '⛰️', element: 'E', name: 'Ironfur', rpgAbilityId: 'ironfur' },
  { id: 'rpg-osmos', rank: 3, suit: '⭐', element: 'W', name: 'Osmos Bubble', rpgAbilityId: 'osmos_bubble' },
  { id: 'rpg-topo', rank: 4, suit: '⛰️', element: 'E', name: 'Topo Rainbow', rpgAbilityId: 'topo_rainbow' },
  { id: 'rpg-prowl', rank: 5, suit: '🌙', element: 'D', name: 'Prowl', rpgAbilityId: 'prowl' },
  { id: 'rpg-aurora', rank: 6, suit: '☀️', element: 'L', name: 'Aurora', rpgAbilityId: 'aurora_bearealis' },
  { id: 'rpg-cheapshot', rank: 7, suit: '💨', element: 'A', name: 'Cheap Shot', rpgAbilityId: 'cheap_shot' },
  { id: 'rpg-void', rank: 8, suit: '🌙', element: 'D', name: 'Void', rpgAbilityId: 'void' },
  { id: 'rpg-solaris', rank: 9, suit: '☀️', element: 'L', name: 'Solar Dynamics', rpgAbilityId: 'solaris' },
  { id: 'rpg-chaos', rank: 10, suit: '🌙', element: 'D', name: 'Chaos', rpgAbilityId: 'chaos_atmosphere' },
];

const SUIT_COLORS: Record<string, string> = {
  '💨': '#f0f0f0', '💧': '#8b5cf6', '🔥': '#e6b31e', '⛰️': '#d946ef', '⭐': '#7fdbca', '🌙': '#4c1d95', '☀️': '#fff5cc', 
};

const GroundingAura = ({ suit }: { suit: string }) => {
  const color = SUIT_COLORS[suit] || '#7fdbca';
  return (
    <div className="absolute w-64 h-64 rounded-full pointer-events-none opacity-40"
      style={{ background: `radial-gradient(circle, ${color}44 0%, ${color}11 40%, transparent 70%)`, transform: 'translate(-50%, -50%)', animation: 'aura-pulse 4s ease-in-out infinite' }}
    />
  );
};

const StaticSpriteLayer = ({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) => (
  <div className={`w-full h-full ${className ?? ''}`} style={style}>
    <img src={src} className="w-full h-full object-contain" alt="" draggable={false} />
  </div>
);

const ActorTemplateCard = memo(({ actor, index, isFlashing, setFoundationRef, lookingNorth, isOverhead, side, isCameraMoving }: {
  actor: Actor, index: number, isFlashing: boolean, setFoundationRef: (idx: number, el: HTMLDivElement | null) => void,
  lookingNorth: boolean, isOverhead: boolean, side: 'player' | 'enemy', isCameraMoving: boolean
}) => {
  const [yOffsetFront, setYOffsetFront] = useState(0);
  const [yOffsetBack, setYOffsetBack] = useState(0);
  const actorDef = getActorDefinition(actor.definitionId);
  const color = SUIT_COLORS[actor.suit ?? '⭐'] || '#7fdbca';
  const coverArt = actorDef?.artSrc ? (actorDef.artSrc.startsWith('/') ? actorDef.artSrc : `/${actorDef.artSrc}`) : '/assets/Bluevee.png';
  const backSprite  = '/assets/actors/battle_back_eevee.png';
  const frontSprite = '/assets/actors/battle_front_eevee.png';

  const isBackFacing = side === 'player' ? lookingNorth : !lookingNorth;
  
  let finalFrontSprite = frontSprite;
  let finalBackSprite = backSprite;

  if (side === 'enemy' || (side === 'player' && index === 0)) {
    finalFrontSprite = '/assets/actors/mochikin/pop_front_mochikin.png';
    finalBackSprite = '/assets/actors/mochikin/pop_mochikin_behind.png';
  } else if (side === 'player' && index === 1) {
    finalFrontSprite = '/assets/actors/ursokin/pop_ursokin_front.png';
    finalBackSprite = '/assets/actors/ursokin/pop_ursokin_behind.png';
  } else if (side === 'player' && index === 2) {
    finalFrontSprite = '/assets/actors/herokin/pop_herokin_front.png';
    finalBackSprite = '/assets/actors/herokin/pop_herokin_behind.png';
  }

  // SANDWICH LOGIC: South skin at 0.05px, North skin at -5.45px
  const southSprite = side === 'player' ? finalBackSprite : finalFrontSprite;
  const northSprite = side === 'player' ? finalFrontSprite : finalBackSprite;
  const southOffset = side === 'player' ? yOffsetBack : yOffsetFront;
  const northOffset = side === 'player' ? yOffsetFront : yOffsetBack;

  return (
    <div className={`rat-root relative w-[120px] h-[180px] flex justify-center items-end px-4 ${!isOverhead ? 'group/rat cursor-pointer' : ''}`} style={{ perspective: '2500px', transformStyle: 'preserve-3d' }}>
      <div ref={el => setFoundationRef(index, el)} className="absolute inset-0 pointer-events-auto" />

      <div className="rat-wrapper bg-black">
        <img 
          src={coverArt} 
          className="w-full h-full object-cover" 
          alt="" 
          style={{ 
            filter: (actor.suit === '💧' || coverArt.toLowerCase().includes('blue')) 
              ? 'brightness(0) contrast(1)' 
              : 'none' 
          }}
        />
        <div className="absolute top-2 left-2 text-xl font-black text-white z-[5]" style={{ textShadow: `0 0 10px ${color}` }}>{actor.hp}</div>
        <div className="absolute top-2 right-2 text-lg z-[5]">{actor.suit}</div>
        {isFlashing && <div className="absolute inset-0 bg-white mix-blend-overlay z-[10] animate-[pulse-white_0.15s_1]" />}
      </div>

      <div className="rat-title"><span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase', textShadow: `0 0 8px ${color}, 0 1px 2px #000` }}>{actor.name}</span></div>

      <div className="rat-character" style={{ transformStyle: 'preserve-3d' }} 
        data-offset-front={yOffsetFront} 
        data-offset-back={yOffsetBack}
        data-side={side}
      >
        <div className="w-full h-full relative" style={{ transformStyle: 'preserve-3d' }}>
          {/* Cardboard Thickness Layers (Core) */}
          {[...Array(10)].map((_, i) => (
            <div key={i} className="rat-char-layer" style={{
              transform: `translate3d(0, 0, ${-i * 0.6}px)`,
              opacity: side === 'enemy' ? 0.3 : 0.4,
              filter: side === 'enemy' ? 'brightness(0.3) saturate(0.5) sepia(1) hue-rotate(240deg) saturate(3)' : 'brightness(0.5) saturate(0.5)',
              backfaceVisibility: 'hidden'
            }}>
              <img src={isBackFacing ? finalBackSprite : finalFrontSprite} className="w-full h-full object-contain" alt="" />
            </div>
          ))}
          {/* South-Facing Repaint (Closer at Yaw 0) */}
          <div className="rat-char-layer" style={{ transform: `translate3d(0, 0, 0.05px)`, backfaceVisibility: 'hidden' }}>
            {side === 'enemy' ? (
              <StaticSpriteLayer
                src={southSprite}
                style={{ filter: 'brightness(0.48) saturate(1.4) hue-rotate(220deg)' }}
              />
            ) : (
              <StaticSpriteLayer src={southSprite} />
            )}
          </div>
          {/* North-Facing Repaint (Sandwiched) */}
          <div className="rat-char-layer" style={{ transform: `translate3d(0, 0, -5.45px) rotateY(180deg)`, backfaceVisibility: 'hidden' }}>
            {side === 'enemy' ? (
              <StaticSpriteLayer
                src={northSprite}
                style={{ filter: 'brightness(0.48) saturate(1.4) hue-rotate(220deg)' }}
              />
            ) : (
              <StaticSpriteLayer src={northSprite} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

const createInitialActors = () => {
  const playerActorIds: Array<'felis' | 'ursus' | 'lupus'> = ['felis', 'ursus', 'lupus'];
  const players = playerActorIds.map(id => createActor(id)).filter((a): a is Actor => !!a);
  const enemy = createActor('shade_of_resentment');
  return { players, enemies: enemy ? [enemy] : [] };
};

const INITIAL_ACTOR_DATA = createInitialActors();

type CameraPose = { x: number; y: number; z: number; yaw: number; pitch: number };

type CachedCardNodes = {
  cardWrapper: HTMLDivElement | null;
  baseCard: HTMLDivElement | null;
  figurine: HTMLDivElement | null;
};

const CameraTelemetry = memo(({ camRef }: { camRef: React.MutableRefObject<CameraPose> }) => {
  const [metrics, setMetrics] = useState({ ...camRef.current });

  useEffect(() => {
    let frameId: number;
    let lastUpdate = 0;
    const loop = (now: number) => {
      if (now - lastUpdate >= 100) {
        setMetrics({ ...camRef.current });
        lastUpdate = now;
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [camRef]);

  return (
    <div className="bg-black/60 border border-game-teal/20 p-4 rounded text-[9px] text-game-teal/80 font-mono tracking-widest pointer-events-auto backdrop-blur-sm">
      <div className="mb-1 text-game-gold font-bold uppercase text-[10px]">Camera Telemetry</div>
      <div className="grid grid-cols-3 gap-x-4">
        <div>X: {metrics.x.toFixed(3)}</div>
        <div>Y: {metrics.y.toFixed(3)}</div>
        <div>Z: {metrics.z.toFixed(3)}</div>
      </div>
      <div className="mt-1 flex gap-4">
        <div>YAW: {metrics.yaw.toFixed(1)}°</div>
        <div>PITCH: {metrics.pitch.toFixed(1)}°</div>
      </div>
    </div>
  );
});

export const ImmersiveBattle = () => {
  const { isImmersive, setIsImmersive } = useImmersiveBattle();
  const ISO_VIEW = { x: -0.230, y: 3.200, z: -1.853, yaw: 340.6, pitch: 25.2 };
  const OTS_VIEW = { x: -0.800, y: 3.200, z: -1.300, yaw: -22.8, pitch: 25.6 };
  const OVERHEAD_VIEW = { x: -1.707, y: 3.2, z: -0.898, yaw: 0.2, pitch: 85 };

  const [viewMode, setViewMode] = useState<'iso' | 'ots' | 'overhead' | 'enemy-ots'>('overhead');
  const [isManualControl, setIsManualControl] = useState(true);
  const [isCinemaPhase, setIsCinemaPhase] = useState(false);
  const [activeEffects, setActiveEffects] = useState<Record<number, string>>({});
  const [damageNumbers, setDamageNumbers] = useState<{ id: string; val: number; x: number; z: number }[]>([]);
  const [isFlashing, setIsFlashing] = useState<Record<number, boolean>>({});
  const [handCards] = useState<CardType[]>(ABILITY_CARDS);
  const [playQueue, setPlayQueue] = useState<{ spell: CardType; targetIdx: number }[]>([]);
  const [fps, setFps] = useState(0);
  const [atmosphereMode, setAtmosphereMode] = useState<ImmersiveAtmosphereMode>('none');
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const [lookingNorth, setLookingNorth] = useState(true);
  const [isOverhead, setIsOverhead] = useState(false);
  const [showHand, setShowHand] = useState(false);
  const cam = useRef(OVERHEAD_VIEW);
  const keys = useRef<Record<string, boolean>>({});
  const isDragging = useRef(false);
  const loopState = useRef({ isManual: true, isImmersive: true, isCinemaPhase: false, viewMode: 'overhead' as 'iso' | 'ots' | 'overhead' | 'enemy-ots' });
  const draggedCardRef = useRef<CardType | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardNodeCacheRef = useRef<Map<number, CachedCardNodes>>(new Map());
  const lastAppliedPoseRef = useRef<CameraPose | null>(null);
  const lastMetricsSampleAtRef = useRef(0);
  const movingUntilRef = useRef(0);
  const isCameraMovingRef = useRef(false);

  useEffect(() => { setIsImmersive(true); }, [setIsImmersive]);
  useEffect(() => { loopState.current = { isManual: isManualControl, isImmersive, isCinemaPhase, viewMode }; }, [isManualControl, isImmersive, isCinemaPhase, viewMode]);

  const markCameraMoving = useCallback((duration = 180) => {
    const until = performance.now() + duration;
    if (until > movingUntilRef.current) movingUntilRef.current = until;
  }, []);

  const registerCardRef = useCallback((idx: number, node: HTMLDivElement | null) => {
    if (!node) {
      cardNodeCacheRef.current.delete(idx);
      return;
    }

    const cardWrapper = node.querySelector('.card-billboard-wrapper') as HTMLDivElement | null;
    const baseCard = node.querySelector('.rat-wrapper') as HTMLDivElement | null;
    if (cardWrapper) cardWrapper.style.transform = 'translateY(-280px)';
    if (baseCard) baseCard.style.transform = 'rotateX(90deg)';

    cardNodeCacheRef.current.set(idx, {
      cardWrapper,
      baseCard,
      figurine: node.querySelector('.rat-character') as HTMLDivElement | null,
    });
  }, []);

  const animateCam = (target: {x:number, y:number, z:number, yaw:number, pitch:number}, duration: number) => {
    return new Promise<void>(resolve => {
      const start = { ...cam.current };
      const startTime = performance.now();
      let targetYaw = target.yaw;
      if (Math.abs(targetYaw - start.yaw) > 180) { if (targetYaw > start.yaw) targetYaw -= 360; else targetYaw += 360; }
      const step = (now: number) => {
        markCameraMoving();
        const t = Math.min(1, (now - startTime) / duration);
        const ease = t * t * (3 - 2 * t);
        cam.current.x = start.x + (target.x - start.x) * ease;
        cam.current.y = start.y + (target.y - start.y) * ease;
        cam.current.z = start.z + (target.z - start.z) * ease;
        cam.current.yaw = start.yaw + (targetYaw - start.yaw) * ease;
        cam.current.pitch = start.pitch + (target.pitch - start.pitch) * ease;
        if (t < 1) requestAnimationFrame(step); else { cam.current.yaw = target.yaw; resolve(); }
      };
      requestAnimationFrame(step);
    });
  };

  const setView = async (mode: 'iso' | 'ots' | 'overhead') => {
    if (isCinemaPhase) return;
    const target = mode === 'iso' ? ISO_VIEW : mode === 'ots' ? OTS_VIEW : OVERHEAD_VIEW;
    setViewMode(mode); setIsManualControl(false);
    await animateCam(target, 800); setIsManualControl(true);
  };

  const teamSwitch = async () => {
    if (isCinemaPhase) return;
    setIsCinemaPhase(true); setIsManualControl(false);
    
    const start = { ...cam.current };
    const isCurrentlyEnemySide = viewMode === 'enemy-ots' || (cam.current.yaw > 90 && cam.current.yaw < 270);
    
    const finalPos = isCurrentlyEnemySide 
      ? { x: -0.800, y: 3.200, z: -1.300, yaw: -22.8, pitch: 25.6 } // Player OTS
      : { x: 0.195, y: 3.365, z: -1.053, yaw: 157.6, pitch: 20.8 }; // Enemy OTS

    const midY = 12.0; // Peak altitude for zoom-out
    const midPitch = 85.0; // Peak pitch looking straight down

    const duration = 2200;
    const startTime = performance.now();
    
    // Normalize targetYaw for shortest rotation
    let targetYaw = finalPos.yaw;
    if (Math.abs(targetYaw - start.yaw) > 180) {
      if (targetYaw > start.yaw) targetYaw -= 360; else targetYaw += 360;
    }

    return new Promise<void>(resolve => {
      const step = (now: number) => {
        const rawT = Math.min(1, (now - startTime) / duration);
        // Overall cubic ease-in-out for the master timeline
        const t = rawT * rawT * (3 - 2 * rawT);

        // 1. HEIGHT & PITCH: Sinusoidal arc for the "swing up" effect
        const hump = Math.sin(t * Math.PI);
        const baseY = start.y + (finalPos.y - start.y) * t;
        cam.current.y = baseY + (midY - baseY) * hump;

        const basePitch = start.pitch + (finalPos.pitch - start.pitch) * t;
        cam.current.pitch = basePitch + (midPitch - basePitch) * hump;

        // 2. TRANSLATION: Linear path in XZ plane
        cam.current.x = start.x + (finalPos.x - start.x) * t;
        cam.current.z = start.z + (finalPos.z - start.z) * t;

        // 3. YAW: Synchronized but concentrated in the high-altitude portion
        // Starts at 20% through the zoom, finishes at 80%
        const yawStart = 0.2;
        const yawEnd = 0.8;
        let tYaw = 0;
        if (t > yawStart) {
          tYaw = Math.min(1, (t - yawStart) / (yawEnd - yawStart));
        }
        const easedYaw = tYaw * tYaw * (3 - 2 * tYaw);
        cam.current.yaw = start.yaw + (targetYaw - start.yaw) * easedYaw;

        if (rawT < 1) {
          requestAnimationFrame(step);
        } else {
          cam.current.yaw = finalPos.yaw;
          setViewMode(isCurrentlyEnemySide ? 'ots' : 'enemy-ots');
          setIsCinemaPhase(false);
          setIsManualControl(true);
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  };

  const teamSwitchAlt = async () => {
    if (isCinemaPhase) return;
    setIsCinemaPhase(true); setIsManualControl(false);
    
    const start = { ...cam.current };
    const isCurrentlyEnemySide = viewMode === 'enemy-ots' || (cam.current.yaw > 90 && cam.current.yaw < 270);
    
    const finalPos = isCurrentlyEnemySide 
      ? { x: -0.800, y: 3.200, z: -1.300, yaw: -22.8, pitch: 25.6 } // Player OTS
      : { x: 0.195, y: 3.365, z: -1.053, yaw: 157.6, pitch: 20.8 }; // Enemy OTS

    const midY = 3.6; // Increased by 20% (from 3.0)
    const midPitch = 54.0; // Increased by 20% (from 45.0)

    const duration = 2200;
    const startTime = performance.now();
    
    // Normalize targetYaw
    let targetYaw = finalPos.yaw;
    
    // Polar Coordinates for Orbital Path
    const startR = Math.sqrt(start.x * start.x + start.z * start.z);
    const startTheta = Math.atan2(start.x, start.z);
    
    const finalR = Math.sqrt(finalPos.x * finalPos.x + finalPos.z * finalPos.z);
    let targetTheta = Math.atan2(finalPos.x, finalPos.z);

    if (!isCurrentlyEnemySide) {
       // Going TO Enemy OTS. Force Clockwise (Increasing Yaw).
       while (targetYaw <= start.yaw) targetYaw += 360;
       
       // Force Clockwise Orbit (Increasing Theta)
       while (targetTheta <= startTheta) targetTheta += 2 * Math.PI;
    } else {
       // Returning to Player OTS. Standard shortest path.
       if (Math.abs(targetYaw - start.yaw) > 180) {
         if (targetYaw > start.yaw) targetYaw -= 360; else targetYaw += 360;
       }
       // Shortest path for orbit too
       while (targetTheta - startTheta > Math.PI) targetTheta -= 2 * Math.PI;
       while (targetTheta - startTheta < -Math.PI) targetTheta += 2 * Math.PI;
    }

    return new Promise<void>(resolve => {
      const step = (now: number) => {
        const rawT = Math.min(1, (now - startTime) / duration);
        const t = rawT * rawT * (3 - 2 * rawT);

        const hump = Math.sin(t * Math.PI);
        const baseY = start.y + (finalPos.y - start.y) * t;
        cam.current.y = baseY + (midY - baseY) * hump;

        const basePitch = start.pitch + (finalPos.pitch - start.pitch) * t;
        cam.current.pitch = basePitch + (midPitch - basePitch) * hump;

        // Polar Interpolation for X/Z (Orbital Swivel)
        const curR = startR + (finalR - startR) * t;
        const curTheta = startTheta + (targetTheta - startTheta) * t;
        cam.current.x = curR * Math.sin(curTheta);
        cam.current.z = curR * Math.cos(curTheta);

        // Synchronized Yaw (exact same timing as height/translation)
        cam.current.yaw = start.yaw + (targetYaw - start.yaw) * t;

        if (rawT < 1) {
          requestAnimationFrame(step);
        } else {
          cam.current.yaw = finalPos.yaw;
          setViewMode(isCurrentlyEnemySide ? 'ots' : 'enemy-ots');
          setIsCinemaPhase(false);
          setIsManualControl(true);
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  };

  const triggerFlashAndDamage = async (targetIdx: number, dmg: number, x: number, z: number) => {
    setIsFlashing(prev => ({ ...prev, [targetIdx]: true }));
    const id = Math.random().toString(36);
    setDamageNumbers(prev => [...prev, { id, val: dmg, x, z }]);
    setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1500);
    await new Promise(r => setTimeout(r, 150));
    setIsFlashing(prev => ({ ...prev, [targetIdx]: false }));
  };

  const performSequenceAttack = async (attackerIdx: number, targetIdx: number, effect: string, dmg: number) => {
    setActiveEffects(prev => ({ ...prev, [targetIdx]: effect }));
    if (effect === 'blackhole') { for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 700)); await triggerFlashAndDamage(targetIdx, 15, 0, 0); } }
    else { await new Promise(r => setTimeout(r, 1200)); await triggerFlashAndDamage(targetIdx, dmg, 0, 0); await new Promise(r => setTimeout(r, 1000)); }
    setActiveEffects(prev => ({ ...prev, [targetIdx]: '' }));
  };

  const executePlayQueue = async () => {
    if (playQueue.length === 0 || isCinemaPhase) return;
    setIsCinemaPhase(true); setIsManualControl(false);
    for (const action of playQueue) {
      const { spell, targetIdx } = action;
      let effectId = 'sparks';
      if (spell.rpgAbilityId === 'void') effectId = 'blackhole';
      if (spell.rpgAbilityId === 'prowl') effectId = 'hyper_wisp';
      if (spell.rpgAbilityId === 'cheap_shot') effectId = 'barrage';
      if (spell.rpgAbilityId === 'aurora_bearealis') effectId = 'super_nova';
      if (spell.rpgAbilityId === 'solaris') effectId = 'solar_dynamics';
      if (spell.rpgAbilityId === 'ironfur') effectId = 'navi';
      if (spell.rpgAbilityId === 'bite') effectId = 'flower_fall';
      if (spell.rpgAbilityId === 'osmos_bubble') effectId = 'osmos_bubble';
      if (spell.rpgAbilityId === 'topo_rainbow') effectId = 'topo_rainbow';
      if (spell.rpgAbilityId === 'chaos_atmosphere') effectId = 'chaos';
      await performSequenceAttack(0, targetIdx, effectId, 50);

    }
    const finalTarget = viewMode === 'iso' ? ISO_VIEW : viewMode === 'ots' ? OTS_VIEW : OVERHEAD_VIEW;
    await animateCam(finalTarget, 1500);
    setPlayQueue([]); setIsCinemaPhase(false); setIsManualControl(true);
  };

  const runCinemaDemo = async () => {
    if (isCinemaPhase) return;
    setPlayQueue([ { spell: ABILITY_CARDS[3], targetIdx: 3 }, { spell: ABILITY_CARDS[0], targetIdx: 3 }, { spell: ABILITY_CARDS[4], targetIdx: 0 } ]);
    setTimeout(() => executePlayQueue(), 100);
  };

  const cycleAtmosphereMode = () => {
    setAtmosphereMode((prev) => {
      const currentIndex = ATMOSPHERE_CYCLE.indexOf(prev);
      return ATMOSPHERE_CYCLE[(currentIndex + 1) % ATMOSPHERE_CYCLE.length];
    });
  };

  const atmosphereLabel = atmosphereMode === 'none'
    ? 'No atmosphere'
    : 'Stars twinkle';

  const atmosphereOverlay = atmosphereMode === 'stars_twinkle_performant'
    ? (
      <StarsTwinklePerformantAtmosphere
        config={{ ...DEFAULT_STARS_TWINKLE_CONFIG, starCount: 280, glowColor: '#60a5fa' }}
        className="w-full h-full"
      />
    )
    : null;

  const { dragState, startDrag, setFoundationRef, dragPositionRef } = useDragDrop((_s, targetIndex) => {
    const spell = draggedCardRef.current; if (!spell) return;
    setPlayQueue(prev => [...prev, { spell, targetIdx: targetIndex }]); draggedCardRef.current = null;
  });

  const startHandDrag = useCallback((card: CardType, idx: number, x: number, y: number, r: DOMRect) => {
    draggedCardRef.current = card; startDrag(card, idx, x, y, r);
  }, [startDrag]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const onMouseDown = () => { if (loopState.current.isManual && !loopState.current.isCinemaPhase) isDragging.current = true; };
    const onMouseUp = () => { isDragging.current = false; };
    const onMouseMove = (e: MouseEvent) => { if (!isDragging.current || !loopState.current.isManual || loopState.current.isCinemaPhase) return;
      markCameraMoving();
      cam.current.yaw -= e.movementX * 0.2; cam.current.pitch = Math.max(-10, Math.min(85, cam.current.pitch + e.movementY * 0.2));
    };
    window.addEventListener('keydown', onKeyDown, true); window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp); window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true); window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); window.removeEventListener('mousemove', onMouseMove);
    };
  }, [markCameraMoving]);

  useEffect(() => {
    let frameId: number; let lastTime = performance.now(); let fpsFrames = 0; let fpsElapsed = 0;
    const loop = (now: number) => {
      const dt = now - lastTime; lastTime = now; fpsFrames++; fpsElapsed += dt;
      if (fpsElapsed >= 500) { setFps(Math.round(fpsFrames * 1000 / fpsElapsed)); fpsFrames = 0; fpsElapsed = 0; }
      const { isManual, isImmersive: immersive, isCinemaPhase: cinema } = loopState.current;
      if (stageRef.current && immersive) {
        if (isManual && !cinema) {
          const speed = 0.005 * dt; const rad = (cam.current.yaw * Math.PI) / 180;
          const hasMovementInput = !!(keys.current['KeyW'] || keys.current['KeyS'] || keys.current['KeyA'] || keys.current['KeyD'] || keys.current['KeyQ'] || keys.current['KeyE']);
          if (hasMovementInput) markCameraMoving();
          if (keys.current['KeyW']) { cam.current.x -= Math.sin(rad) * speed; cam.current.z -= Math.cos(rad) * speed; }
          if (keys.current['KeyS']) { cam.current.x += Math.sin(rad) * speed; cam.current.z += Math.cos(rad) * speed; }
          if (keys.current['KeyA']) { cam.current.x -= Math.cos(rad) * speed; cam.current.z += Math.sin(rad) * speed; }
          if (keys.current['KeyD']) { cam.current.x += Math.cos(rad) * speed; cam.current.z -= Math.sin(rad) * speed; }
          if (keys.current['KeyQ']) { cam.current.y += speed; } if (keys.current['KeyE']) { cam.current.y -= speed; }
          if (cam.current.y < 0.5) cam.current.y = 0.5;
        }
        const { x, y, z, yaw, pitch } = cam.current; 
        const popFactor = Math.max(0, Math.min(1, (85 - pitch) / 40));
        const relYaw = ((yaw + 180) % 360 + 360) % 360 - 180;
        const absRelYaw = Math.abs(relYaw);
        const weight = Math.pow(Math.sin((absRelYaw / 90) * (Math.PI / 2)), 1.5) * 0.45;
        let targetRot = Math.max(-35, Math.min(35, relYaw * weight));
        if (absRelYaw >= 80 && absRelYaw <= 100) targetRot = Math.sign(relYaw) * 35;
        const normalizedYaw = ((yaw % 360) + 360) % 360;
        
        // DERIVED STABLE BOOLEANS
        const lookingNorthNow = normalizedYaw < 90 || normalizedYaw > 270;
        const isOverheadNow = pitch > 60;
        const showHandNow = pitch > 45 && !cinema;

        // Use functional updates to avoid dependency on state variables themselves in the loop's closure scope if possible, 
        // but here we just want to minimize React work.
        setLookingNorth(prev => prev === lookingNorthNow ? prev : lookingNorthNow);
        setIsOverhead(prev => prev === isOverheadNow ? prev : isOverheadNow);
        setShowHand(prev => prev === showHandNow ? prev : showHandNow);

        const figurineRotateX = 90 - 90 * popFactor;
        const figurineScale = 0.8 + popFactor * 0.5;
        const movingNow = cinema || now < movingUntilRef.current;
        if (movingNow !== isCameraMovingRef.current) {
          isCameraMovingRef.current = movingNow;
          setIsCameraMoving(movingNow);
        }
        const lastPose = lastAppliedPoseRef.current;
        const poseChanged =
          !lastPose ||
          Math.abs(lastPose.x - x) > 0.0005 ||
          Math.abs(lastPose.y - y) > 0.0005 ||
          Math.abs(lastPose.z - z) > 0.0005 ||
          Math.abs(lastPose.yaw - yaw) > 0.05 ||
          Math.abs(lastPose.pitch - pitch) > 0.05;

        if (poseChanged) {
          stageRef.current.style.setProperty('--pop-factor', popFactor.toString());
          stageRef.current.style.transform = `rotateX(${-pitch}deg) rotateY(${-yaw}deg) translate3d(${-x * 100}px, ${y * 100}px, ${-z * 100}px)`;
          cardNodeCacheRef.current.forEach((nodes, idx) => {
            const { figurine } = nodes;
            if (figurine) {
              const offsetFront = parseFloat(figurine.dataset.offsetFront || '0');
              const offsetBack = parseFloat(figurine.dataset.offsetBack || '0');
              const side = figurine.dataset.side;
              const isBackFacing = side === 'player' ? lookingNorthNow : !lookingNorthNow;
              const currentOffset = isBackFacing ? offsetBack : offsetFront;
              const flip = (idx === 1 || idx === 2) ? -1 : 1;

              figurine.style.transformOrigin = `50% calc(100% + ${currentOffset}px) -2.7px`;
              figurine.style.transform = `translate3d(0, ${currentOffset}px, 0) rotateY(${targetRot}deg) rotateX(${figurineRotateX}deg) scale(${figurineScale})${flip === -1 ? ' scaleX(-1)' : ''}`;
            }
          });

          // BILLBOARD GENERIC ELEMENTS (Damage Numbers)
          const billboards = stageRef.current.querySelectorAll('[data-billboard=\"true\"]');
          billboards.forEach((el: any) => {
            const bx = el.dataset.x || '0';
            const bz = el.dataset.z || '0';
            el.style.transform = `translate3d(${bx * 100}px, -320px, ${bz * 100}px) rotateY(${yaw}deg) rotateX(${pitch}deg)`;
          });

          lastAppliedPoseRef.current = { x, y, z, yaw, pitch };
        }
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop); return () => cancelAnimationFrame(frameId);
  }, [markCameraMoving]);

  return (
    <div className="relative w-screen h-screen bg-[#020205] overflow-hidden select-none outline-none" style={{ perspective: '1000px' }}>
      <style>{`
        @keyframes aura-pulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.3); opacity: 0.6; } }
        @keyframes pulse-white { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(10); } }
        .rat-wrapper { position: absolute; width: 100%; height: 100%; z-index: -1; border-radius: 8px; overflow: hidden; border: 2px solid white; transform: translateZ(0); }
        .rat-title { width: 100%; transition: transform 0.5s ease-out; z-index: 3; text-align: center; margin-bottom: 20px; transform: translateZ(5px); }
        .group\\/rat:hover .rat-title { transform: translate3d(0%, -20px, 40px); }
        .rat-character { width: 100%; height: 120px; opacity: var(--pop-factor, 0); position: absolute; z-index: 4; left: 0; bottom: 50%; pointer-events: none; transform-origin: bottom center; transform-style: preserve-3d; }
        .rat-char-layer { position: absolute; inset: 0; transform-style: preserve-3d; }
      `}</style>
      {/* Atmosphere is now in the background, masked naturally by the opaque ground plane at the horizon */}
      {atmosphereOverlay && !isCameraMoving && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          {atmosphereOverlay}
        </div>
      )}
      <div ref={stageRef} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transformStyle: 'preserve-3d', zIndex: 1 }}>
        <div className="relative w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
          {/* Infinite Ground Plane: Opaque background masks the atmosphere at the horizon */}
          <div 
            className="absolute w-[20000px] h-[20000px] pointer-events-none" 
            style={{ 
              backgroundColor: '#020205',
              backgroundImage: `linear-gradient(rgba(127, 219, 202, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(127, 219, 202, 0.2) 1px, transparent 1px)`, 
              backgroundSize: '150px 150px', 
              transform: 'rotateX(90deg)', 
              opacity: isImmersive ? 1 : 0 
            }} 
          />
          <div className="relative w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
            {damageNumbers.map(d => (
              <div key={d.id} 
                className="absolute pointer-events-none damage-billboard" 
                data-billboard="true"
                data-x={d.x}
                data-z={d.z}
                style={{ transform: `translate3d(${d.x * 100}px, -320px, ${d.z * 100}px) rotateY(${cam.current.yaw}deg) rotateX(${cam.current.pitch}deg)` }}
              >
                <motion.div initial={{ y: 0, opacity: 0, scale: 0.5 }} animate={{ y: -80, opacity: 1, scale: 1.2 }} exit={{ opacity: 0 }} className="text-4xl font-black text-game-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.8)] font-mono">{d.val}</motion.div>
              </div>
            ))}
            <div className="absolute flex justify-center w-full" style={{ transform: 'translate3d(0, 0, -300px)', transformStyle: 'preserve-3d' }}>
              <div className="flex gap-24" style={{ transformStyle: 'preserve-3d' }}>
                {INITIAL_ACTOR_DATA.enemies.map((actor, i) => {
                  const idx = i + 3;
                  return (
                    <div key={idx} ref={(el) => registerCardRef(idx, el)} className="relative group flex items-center justify-center pointer-events-auto" style={{ transformStyle: 'preserve-3d' }}>
                      <div style={{ transform: 'rotateX(90deg)', transformStyle: 'preserve-3d' }} className="absolute"><GroundingAura suit={actor.suit ?? ''} /></div>
                      <div className="card-billboard-wrapper" style={{ transformStyle: 'preserve-3d' }}>
                        <ActorTemplateCard actor={actor} index={idx} isFlashing={isFlashing[idx]} setFoundationRef={setFoundationRef} lookingNorth={lookingNorth} isOverhead={isOverhead} side="enemy" isCameraMoving={isCameraMoving} />
                        {!isCameraMoving && <div className="absolute inset-0 pointer-events-none z-[100]">
                          {activeEffects[idx] === 'sparks' && <SparksPericulumEffect className="scale-150" />}
                          {activeEffects[idx] === 'blackhole' && <LocalizedBlackHoleEffect className="scale-150" />}
                          {activeEffects[idx] === 'barrage' && <CosmicNeutronBarrageEffect className="scale-150" />}
                          {activeEffects[idx] === 'godrays' && <GodRaysEffect className="scale-150" />}
                          {activeEffects[idx] === 'gommage' && <GommageEffect className="scale-150" />}
                          {activeEffects[idx] === 'navi' && <SpawnNaviEffect className="scale-150" />}
                          {activeEffects[idx] === 'bat_fly' && <BatFlyEffect className="scale-150" />}
                          {activeEffects[idx] === 'flower_fall' && <FlowerFallEffect className="scale-150" />}
                          {activeEffects[idx] === 'osmos_bubble' && <OsmosBubbleEffect className="scale-150" />}
                          {activeEffects[idx] === 'confetti' && <ConfettiFallEffect className="scale-150" />}
                          {activeEffects[idx] === 'hyper_wisp' && <HyperWispEffect className="scale-150" />}
                          {activeEffects[idx] === 'super_nova' && <SuperNovaEffect className="scale-150" />}
                          {activeEffects[idx] === 'topo_rainbow' && <TopoRainbowEffect className="scale-150" />}
                          {activeEffects[idx] === 'chaos' && <ChaosAtmosphereEffect className="scale-150" quality={isCameraMoving ? 'moving' : 'full'} />}
                        </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="absolute flex justify-center w-full" style={{ transform: 'translate3d(0, 0, 0px)', transformStyle: 'preserve-3d' }}>
              <div className="flex gap-24" style={{ transformStyle: 'preserve-3d' }}>
                {INITIAL_ACTOR_DATA.players.map((actor, i) => (
                  <div key={i} ref={(el) => registerCardRef(i, el)} className="relative group flex items-center justify-center pointer-events-auto" style={{ transformStyle: 'preserve-3d' }}>
                    <div style={{ transform: 'rotateX(90deg)', transformStyle: 'preserve-3d' }} className="absolute"><GroundingAura suit={actor.suit ?? ''} /></div>
                    <div className="card-billboard-wrapper" style={{ transformStyle: 'preserve-3d' }}>
                      <ActorTemplateCard actor={actor} index={i} isFlashing={isFlashing[i]} setFoundationRef={setFoundationRef} lookingNorth={lookingNorth} isOverhead={isOverhead} side="player" isCameraMoving={isCameraMoving} />
                      {!isCameraMoving && <div className="absolute inset-0 pointer-events-none z-[100]">
                        {activeEffects[i] === 'sparks' && <SparksPericulumEffect className="scale-150" />}
                        {activeEffects[i] === 'blackhole' && <LocalizedBlackHoleEffect className="scale-150" />}
                        {activeEffects[i] === 'barrage' && <CosmicNeutronBarrageEffect className="scale-150" />}
                        {activeEffects[i] === 'godrays' && <GodRaysEffect className="scale-150" />}
                        {activeEffects[i] === 'gommage' && <GommageEffect className="scale-150" />}
                        {activeEffects[i] === 'navi' && <SpawnNaviEffect className="scale-150" />}
                        {activeEffects[i] === 'bat_fly' && <BatFlyEffect className="scale-150" />}
                        {activeEffects[i] === 'flower_fall' && <FlowerFallEffect className="scale-150" />}
                        {activeEffects[i] === 'osmos_bubble' && <OsmosBubbleEffect className="scale-150" />}
                        {activeEffects[i] === 'confetti' && <ConfettiFallEffect className="scale-150" />}
                        {activeEffects[i] === 'hyper_wisp' && <HyperWispEffect className="scale-150" />}
                        {activeEffects[i] === 'super_nova' && <SuperNovaEffect className="scale-150" />}
                        {activeEffects[i] === 'topo_rainbow' && <TopoRainbowEffect className="scale-150" />}
                        {activeEffects[i] === 'chaos' && <ChaosAtmosphereEffect className="scale-150" quality={isCameraMoving ? 'moving' : 'full'} />}
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8" style={{ zIndex: 100 }}>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-4">
            <div className={`bg-black/80 border border-game-teal/30 px-4 py-3 rounded-xl pointer-events-auto ${isCameraMoving ? '' : 'backdrop-blur-md'}`}>
              <div className="flex items-center gap-4">
                <div className="text-sm text-game-teal font-mono font-bold whitespace-nowrap">{fps} fps</div>
                <div className="text-sm text-game-gold font-mono font-bold whitespace-nowrap">{playQueue.length}</div>
                <button
                  onClick={cycleAtmosphereMode}
                  className={`w-9 h-9 rounded-md text-base border transition-all ${
                    atmosphereMode === 'none'
                      ? 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                      : 'bg-game-teal/20 text-game-teal border-game-teal/40 shadow-[0_0_12px_rgba(127,219,202,0.22)] hover:bg-game-teal/30'
                  }`}
                  title={`Atmosphere: ${atmosphereLabel}`}
                  aria-label={`Atmosphere mode: ${atmosphereLabel}`}
                >
                  ⚡
                </button>
              </div>
            </div>

            {/* Sidebar HUD for Camera Animations */}
            <div className="flex flex-col gap-2 pointer-events-auto items-start">
              <button 
                onClick={teamSwitch} 
                disabled={isCinemaPhase}
                className="w-full bg-black/60 hover:bg-game-teal/20 border border-game-teal/40 px-4 py-2 rounded-sm text-[10px] text-game-teal font-bold uppercase tracking-[0.2em] transition-all text-left flex items-center gap-3 group"
              >
                <div className="w-1.5 h-1.5 bg-game-teal rotate-45 group-hover:scale-125 transition-transform" />
                Team Switch
              </button>
              <button 
                onClick={teamSwitchAlt} 
                disabled={isCinemaPhase}
                className="w-full bg-black/60 hover:bg-game-teal/20 border border-game-teal/40 px-4 py-2 rounded-sm text-[10px] text-game-teal font-bold uppercase tracking-[0.2em] transition-all text-left flex items-center gap-3 group"
              >
                <div className="w-1.5 h-1.5 bg-game-teal rotate-45 group-hover:scale-125 transition-transform" />
                Team Switch (Alt)
              </button>
            </div>
          </div>

          <div className="flex gap-2 pointer-events-auto items-center">
             <button onClick={runCinemaDemo} disabled={isCinemaPhase} className="bg-game-gold text-black px-6 py-2 rounded-sm text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(255,215,0,0.4)] hover:brightness-125 transition-all">DEMO</button>
             <button onClick={executePlayQueue} disabled={isCinemaPhase || playQueue.length === 0} className="bg-game-teal text-black px-6 py-2 rounded-sm text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(127,219,202,0.4)] hover:brightness-125 transition-all">PLAY</button>
             <div className="flex bg-black/40 p-1 rounded-sm border border-game-teal/20 gap-1">
               <button onClick={() => setView('overhead')} className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase ${viewMode === 'overhead' ? 'bg-game-teal text-black' : 'text-game-teal'}`}>TO</button>
               <button onClick={() => setView('ots')} className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase ${viewMode === 'ots' ? 'bg-game-teal text-black' : 'text-game-teal'}`}>OTS</button>
               <button onClick={() => setView('iso')} className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase ${viewMode === 'iso' ? 'bg-game-teal text-black' : 'text-game-teal'}`}>ISO</button>
             </div>
             <button onClick={() => setIsManualControl(!isManualControl)} className={`px-3 py-2 rounded-sm text-[10px] font-bold border transition-all ${isManualControl ? 'bg-game-gold text-black shadow-md hover:brightness-110' : 'bg-white/10 text-white hover:bg-white/20'}`}>
               {isManualControl ? 'FREE' : 'FIXED'}
             </button>
             <button onClick={() => setIsImmersive(!isImmersive)} className="bg-game-teal/20 border border-game-teal/40 px-3 py-2 rounded-sm text-[10px] text-game-teal font-bold uppercase hover:bg-game-teal/30 transition-all">
               {isImmersive ? 'Exit' : 'Enter'}
             </button>
          </div>
        </div>
        <div className="flex justify-between items-end w-full">
          <CameraTelemetry camRef={cam} />
          <AnimatePresence>
            {showHand && !isCinemaPhase && (
              <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} className="pointer-events-auto flex justify-center pb-8 mr-auto ml-auto">
                <Hand cards={handCards} cardScale={1.4} onDragStart={startHandDrag} draggingCardId={dragState.card?.id} isAnyCardDragging={dragState.isDragging} showGraphics interactionMode="dnd" disableTilt />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
