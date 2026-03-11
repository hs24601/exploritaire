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
import { ContinualRepaintEffect, DEFAULT_CONTINUAL_REPAINT_CONFIG } from '../components/active/ContinualRepaintEffect';
import { getActorDefinition } from '../engine/actors';

// Effects Library
import { SparksPericulumEffect } from '../components/active/SparksPericulumEffect';
import { LocalizedBlackHoleEffect } from '../components/active/LocalizedBlackHoleEffect';
import { CosmicNeutronBarrageEffect } from '../components/active/CosmicNeutronBarrageEffect';
import { GodRaysEffect } from '../components/active/GodRaysEffect';
import { GommageEffect } from '../components/active/GommageEffect';
import { SpawnNaviEffect } from '../components/active/SpawnNaviEffect';
import { BatFlyEffect } from '../components/active/BatFlyEffect';
import { FlowerFallEffect } from '../components/active/FlowerFallEffect';
import { OsmosBubbleEffect } from '../components/active/OsmosBubbleEffect';
import { ConfettiFallEffect } from '../components/active/ConfettiFallEffect';
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

const ActorTemplateCard = memo(({ actor, index, isFlashing, setFoundationRef, camYaw: camYawProp, camPitch, side }: {
  actor: Actor, index: number, isFlashing: boolean, setFoundationRef: (idx: number, el: HTMLDivElement | null) => void,
  camYaw: number, camPitch: number, side: 'player' | 'enemy'
}) => {
  const [yOffsetFront, setYOffsetFront] = useState(0);
  const [yOffsetBack, setYOffsetBack] = useState(0);
  const actorDef = getActorDefinition(actor.definitionId);
  const color = SUIT_COLORS[actor.suit ?? '⭐'] || '#7fdbca';
  const coverArt = actorDef?.artSrc ? (actorDef.artSrc.startsWith('/') ? actorDef.artSrc : `/${actorDef.artSrc}`) : '/assets/Bluevee.png';
  const backSprite  = '/assets/actors/battle_back_eevee.png';
  const frontSprite = '/assets/actors/battle_front_eevee.png';

  const isOverhead = camPitch > 60;
  const normalizedYaw = ((camYawProp % 360) + 360) % 360;
  
  const lookingNorth = normalizedYaw < 90 || normalizedYaw > 270;
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
    finalFrontSprite = '/assets/actors/hirokin/pop_hirokin_front.png';
    finalBackSprite = '/assets/actors/hirokin/pop_hirokin_behind.png';
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
              opacity: 0.4,
              filter: 'brightness(0.5) saturate(0.5)',
              backfaceVisibility: 'hidden'
            }}>
              <img src={isBackFacing ? finalBackSprite : finalFrontSprite} className="w-full h-full object-contain" alt="" />
            </div>
          ))}
          {/* South-Facing Repaint (Closer at Yaw 0) */}
          <div className="rat-char-layer" style={{ transform: `translate3d(0, 0, 0.05px)`, backfaceVisibility: 'hidden' }}>
            <ContinualRepaintEffect 
              config={{ ...DEFAULT_CONTINUAL_REPAINT_CONFIG, imgUrl: southSprite, strokeMax: 100, varRot: 0.785, countPerFrame: 150, varW: 5, velocity: 8.0, highFidelity: true, desaturate: side === 'enemy' }} 
              transparent 
              className="w-full h-full" 
              onOffsetComputed={side === 'player' ? setYOffsetBack : setYOffsetFront}
            />
          </div>
          {/* North-Facing Repaint (Sandwiched) */}
          <div className="rat-char-layer" style={{ transform: `translate3d(0, 0, -5.45px) rotateY(180deg)`, backfaceVisibility: 'hidden' }}>
            <ContinualRepaintEffect 
              config={{ ...DEFAULT_CONTINUAL_REPAINT_CONFIG, imgUrl: northSprite, strokeMax: 100, varRot: 0.785, countPerFrame: 150, varW: 5, velocity: 8.0, highFidelity: true, desaturate: side === 'enemy' }} 
              transparent 
              className="w-full h-full" 
              onOffsetComputed={side === 'player' ? setYOffsetFront : setYOffsetBack}
            />
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

export const ImmersiveBattle = () => {
  const { isImmersive, setIsImmersive } = useImmersiveBattle();
  const ISO_VIEW = { x: -0.8, y: 3.2, z: -1.3, yaw: -36, pitch: 10 };
  const OTS_VIEW = { x: -0.8, y: 3.2, z: -1.3, yaw: 2, pitch: 11 };
  const OVERHEAD_VIEW = { x: -1.707, y: 3.2, z: -0.898, yaw: 0.2, pitch: 85 };

  const [viewMode, setViewMode] = useState<'iso' | 'ots' | 'overhead'>('overhead');
  const [isManualControl, setIsManualControl] = useState(true);
  const [isCinemaPhase, setIsCinemaPhase] = useState(false);
  const [activeEffects, setActiveEffects] = useState<Record<number, string>>({});
  const [damageNumbers, setDamageNumbers] = useState<{ id: string; val: number; x: number; z: number }[]>([]);
  const [isFlashing, setIsFlashing] = useState<Record<number, boolean>>({});
  const [handCards] = useState<CardType[]>(ABILITY_CARDS);
  const [playQueue, setPlayQueue] = useState<{ spell: CardType; targetIdx: number }[]>([]);
  const [metrics, setMetrics] = useState(OVERHEAD_VIEW);
  const [fps, setFps] = useState(0);
  const cam = useRef(OVERHEAD_VIEW);
  const keys = useRef<Record<string, boolean>>({});
  const isDragging = useRef(false);
  const loopState = useRef({ isManual: true, isImmersive: true, isCinemaPhase: false, viewMode: 'overhead' as 'iso' | 'ots' | 'overhead' });
  const draggedCardRef = useRef<CardType | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => { setIsImmersive(true); }, [setIsImmersive]);
  useEffect(() => { loopState.current = { isManual: isManualControl, isImmersive, isCinemaPhase, viewMode }; }, [isManualControl, isImmersive, isCinemaPhase, viewMode]);

  const animateCam = (target: {x:number, y:number, z:number, yaw:number, pitch:number}, duration: number) => {
    return new Promise<void>(resolve => {
      const start = { ...cam.current };
      const startTime = performance.now();
      let targetYaw = target.yaw;
      if (Math.abs(targetYaw - start.yaw) > 180) { if (targetYaw > start.yaw) targetYaw -= 360; else targetYaw += 360; }
      const step = (now: number) => {
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
      cam.current.yaw -= e.movementX * 0.2; cam.current.pitch = Math.max(-10, Math.min(85, cam.current.pitch + e.movementY * 0.2));
    };
    window.addEventListener('keydown', onKeyDown, true); window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp); window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true); window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  useEffect(() => {
    let frameId: number; let lastTime = performance.now(); let fpsFrames = 0; let fpsElapsed = 0;
    const loop = (now: number) => {
      const dt = now - lastTime; lastTime = now; fpsFrames++; fpsElapsed += dt;
      if (fpsElapsed >= 500) { setFps(Math.round(fpsFrames * 1000 / fpsElapsed)); fpsFrames = 0; fpsElapsed = 0; }
      const { isManual, isImmersive: immersive, isCinemaPhase: cinema } = loopState.current;
      if (stageRef.current && immersive) {
        if (isManual && !cinema) {
          const speed = 0.005 * dt; const rad = (cam.current.yaw * Math.PI) / 180;
          if (keys.current['KeyW']) { cam.current.x -= Math.sin(rad) * speed; cam.current.z -= Math.cos(rad) * speed; }
          if (keys.current['KeyS']) { cam.current.x += Math.sin(rad) * speed; cam.current.z += Math.cos(rad) * speed; }
          if (keys.current['KeyA']) { cam.current.x -= Math.cos(rad) * speed; cam.current.z += Math.sin(rad) * speed; }
          if (keys.current['KeyD']) { cam.current.x += Math.cos(rad) * speed; cam.current.z -= Math.sin(rad) * speed; }
          if (keys.current['KeyQ']) { cam.current.y += speed; } if (keys.current['KeyE']) { cam.current.y -= speed; }
          if (cam.current.y < 0.5) cam.current.y = 0.5;
        }
        const { x, y, z, yaw, pitch } = cam.current; 
        const popFactor = Math.max(0, Math.min(1, (85 - pitch) / 40));
        stageRef.current.style.setProperty('--pop-factor', popFactor.toString());
        stageRef.current.style.transform = `rotateX(${-pitch}deg) rotateY(${-yaw}deg) translate3d(${-x * 100}px, ${y * 100}px, ${-z * 100}px)`;
        cardRefs.current.forEach((el, idx) => {
          if (el) {
            const cardWrapper = el.querySelector('.card-billboard-wrapper') as HTMLDivElement;
            const baseCard = el.querySelector('.rat-wrapper') as HTMLDivElement;
            const figurine = el.querySelector('.rat-character') as HTMLDivElement;
            if (cardWrapper) cardWrapper.style.transform = `translateY(-280px)`;
            if (baseCard) baseCard.style.transform = `rotateX(90deg)`;
            if (figurine) {
              const offsetFront = parseFloat(figurine.dataset.offsetFront || '0');
              const offsetBack = parseFloat(figurine.dataset.offsetBack || '0');
              const side = figurine.dataset.side;
              
              let relYaw = yaw % 360;
              if (relYaw > 180) relYaw -= 360;
              if (relYaw < -180) relYaw += 360;

              const absRelYaw = Math.abs(relYaw);
              const weight = Math.pow(Math.sin((absRelYaw / 90) * (Math.PI / 2)), 1.5) * 0.45;
              let targetRot = relYaw * weight;
              targetRot = Math.max(-35, Math.min(35, targetRot));

              if (absRelYaw >= 80 && absRelYaw <= 100) {
                targetRot = Math.sign(relYaw) * 35;
              }
              
              const normalizedYaw = ((yaw % 360) + 360) % 360;
              const lookingNorth = normalizedYaw < 90 || normalizedYaw > 270;
              const isBackFacing = side === 'player' ? lookingNorth : !lookingNorth;
              const currentOffset = isBackFacing ? offsetBack : offsetFront;

              // RUBRIC: TAILS OUT.
              let flip = 1;
              if (idx === 0) flip = -1; // Mochi: flip to face Right (Tail Left - OUT)
              else if (idx === 2) flip = 1; // Hiro: face Left (Tail Right - OUT)
              else if (idx === 3) flip = -1; // Enemy: flip to face Right (South/Players)
              
              // PRECISION SYNC: Pivot around the grounded baseline at the middle of the 3D stack
              figurine.style.transformOrigin = `50% calc(100% + ${currentOffset}px) -2.7px`;
              figurine.style.transform = `translate3d(0, ${currentOffset}px, 0) rotateY(${targetRot}deg) rotateX(${90 - 90 * popFactor}deg) scale(${0.8 + popFactor * 0.5})${flip === -1 ? ' scaleX(-1)' : ''}`;
            }
          }
        });
        setMetrics({ x, y, z, yaw, pitch });
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop); return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#020205] overflow-hidden select-none outline-none" style={{ perspective: '1000px' }}>
      <style>{`
        @keyframes aura-pulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.3); opacity: 0.6; } }
        @keyframes pulse-white { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(10); } }
        .rat-wrapper { transition: all 0.5s; position: absolute; width: 100%; height: 100%; z-index: -1; border-radius: 8px; overflow: hidden; border: 2px solid white; transform: translateZ(0); }
        .rat-title { width: 100%; transition: transform 0.5s ease-out; z-index: 3; text-align: center; margin-bottom: 20px; transform: translateZ(5px); }
        .group\\/rat:hover .rat-title { transform: translate3d(0%, -20px, 40px); }
        .rat-character { width: 100%; height: 120px; opacity: var(--pop-factor, 0); position: absolute; z-index: 4; left: 0; bottom: 50%; pointer-events: none; transform-origin: bottom center; transform-style: preserve-3d; }
        .rat-char-layer { position: absolute; inset: 0; transform-style: preserve-3d; }
      `}</style>
      <div ref={stageRef} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
        <div className="relative w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
          <div className="absolute w-[10000px] h-[10000px] pointer-events-none" style={{ background: `linear-gradient(rgba(100, 150, 255, 0.2) 2px, transparent 2px), linear-gradient(90deg, rgba(100, 150, 255, 0.2) 2px, transparent 2px)`, backgroundSize: '200px 200px', transform: 'rotateX(90deg)', opacity: isImmersive ? 1 : 0 }} />
          <div className="relative w-full h-full flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
            {damageNumbers.map(d => (
              <div key={d.id} className="absolute pointer-events-none" style={{ transform: `translate3d(${d.x * 100}px, -320px, ${d.z * 100}px) rotateY(${cam.current.yaw}deg) rotateX(${cam.current.pitch}deg)` }}>
                <motion.div initial={{ y: 0, opacity: 0, scale: 0.5 }} animate={{ y: -80, opacity: 1, scale: 1.2 }} exit={{ opacity: 0 }} className="text-4xl font-black text-game-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.8)] font-mono">{d.val}</motion.div>
              </div>
            ))}
            <div className="absolute flex justify-center w-full" style={{ transform: 'translate3d(0, 0, -300px)', transformStyle: 'preserve-3d' }}>
              <div className="flex gap-24" style={{ transformStyle: 'preserve-3d' }}>
                {INITIAL_ACTOR_DATA.enemies.map((actor, i) => {
                  const idx = i + 3;
                  return (
                    <div key={idx} ref={el => { if(el) cardRefs.current.set(idx, el); }} className="relative group flex items-center justify-center pointer-events-auto" style={{ transformStyle: 'preserve-3d' }}>
                      <div style={{ transform: 'rotateX(90deg)', transformStyle: 'preserve-3d' }} className="absolute"><GroundingAura suit={actor.suit ?? ''} /></div>
                      <div className="card-billboard-wrapper" style={{ transformStyle: 'preserve-3d' }}>
                        <ActorTemplateCard actor={actor} index={idx} isFlashing={isFlashing[idx]} setFoundationRef={setFoundationRef} camYaw={metrics.yaw} camPitch={metrics.pitch} side="enemy" />
                        <div className="absolute inset-0 pointer-events-none z-[100]">
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="absolute flex justify-center w-full" style={{ transform: 'translate3d(0, 0, 0px)', transformStyle: 'preserve-3d' }}>
              <div className="flex gap-24" style={{ transformStyle: 'preserve-3d' }}>
                {INITIAL_ACTOR_DATA.players.map((actor, i) => (
                  <div key={i} ref={el => { if(el) cardRefs.current.set(i, el); }} className="relative group flex items-center justify-center pointer-events-auto" style={{ transformStyle: 'preserve-3d' }}>
                    <div style={{ transform: 'rotateX(90deg)', transformStyle: 'preserve-3d' }} className="absolute"><GroundingAura suit={actor.suit ?? ''} /></div>
                    <div className="card-billboard-wrapper" style={{ transformStyle: 'preserve-3d' }}>
                      <ActorTemplateCard actor={actor} index={i} isFlashing={isFlashing[i]} setFoundationRef={setFoundationRef} camYaw={metrics.yaw} camPitch={metrics.pitch} side="player" />
                      <div className="absolute inset-0 pointer-events-none z-[100]">
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
                      </div>
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
          <div className="bg-black/80 backdrop-blur-md border border-game-teal/30 p-6 rounded-xl pointer-events-auto min-w-[200px]">
            <h1 className="text-game-teal font-bold tracking-[2px] text-[10px] mb-2 uppercase text-center opacity-80">Sync Tooling <span className="opacity-60">({fps} fps)</span></h1>
            <div className="text-2xl text-game-teal font-mono font-bold text-center text-game-gold">{playQueue.length}</div>
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
          <div className="bg-black/60 backdrop-blur-sm border border-game-teal/20 p-4 rounded text-[9px] text-game-teal/80 font-mono tracking-widest pointer-events-auto">
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
          <AnimatePresence>
            {metrics.pitch > 45 && !isCinemaPhase && (
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
