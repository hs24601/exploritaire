import { gameTime } from '../../gameTime';
import { useActorExpression } from '../actorExpression';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { loadMediaTexture } from '../mediaTexture';
import { battleSpriteAssets, HERO_EXPRESSION_ASSETS } from '../battleSpriteAssets';
import { OPENING_HERO_ASSETS } from '../openingHeroAssets';
import { useArtStyle } from '../artStyle';
import { createDirectionalSpriteLibrary } from '../directionalSpriteRig';
import { HERO_DIRECTIONAL_SPRITE } from '../directionalSprites';
import { MOCHI_DIRECTIONAL_SPRITE } from '../mochiSprite';
import { BANKS_DIRECTIONAL_SPRITE, BANKS_POSES, BANKS_SPRITE_ASSETS } from '../banksSprite';
import { HERO_SITTING_DIRECTIONAL_SPRITE } from '../heroSittingSprite';
import { HERO_WALKING_DIRECTIONAL_SPRITE, HERO_WALK_STRIDE } from '../heroWalkingSprite';
import type { TableTilt } from '../tableTilt';

type Camera = { x: number; y: number; scale: number; yaw?: number };
/** Invert the CSS table rotation/pan to locate the eye in table coordinates.
 * Table +Y corresponds to the combat rig's +Z. */
export function tableSpriteEye(camera: Camera, tilt: TableTilt, position: { x: number; y: number }) {
  const angle = tilt.angle * Math.PI / 180, yaw = (camera.yaw ?? 0) * Math.PI / 180;
  const x = -camera.x / camera.scale;
  const z = (tilt.perspective * Math.sin(angle) - camera.y) / camera.scale;
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw) - position.x,
    y: tilt.perspective * Math.cos(angle) / camera.scale,
    z: -x * Math.sin(yaw) + z * Math.cos(yaw) - position.y };
}

/** The shared combat rig paints into a transparent CSS standee. CSS owns the
 * table projection; this local renderer only assembles the sectional artwork. */
export function TableActorSprite({ actorId = 'hero', position, heading, getCamera, getTilt, getWorldPose, fallback, brightness = 1, pose = 'standing', overhead = false }:
  { actorId?: 'hero' | 'mochi' | 'banks'; position: { x: number; y: number }; heading: number; getCamera: () => Camera; getTilt: (camera: Camera) => TableTilt; getWorldPose?: () => { position: { x: number; y: number }; heading: number } | null; fallback: ReactNode; brightness?: number; pose?: 'standing' | 'sitting' | 'walking'; overhead?: boolean }) {
  const artStyle = useArtStyle();
  const expression = useActorExpression(actorId);
  const expressionRef = useRef(expression); expressionRef.current = expression;
  const host = useRef<HTMLSpanElement>(null);
  const live = useRef({ position, heading, getCamera, getTilt, getWorldPose, pose, overhead }); live.current = { position, heading, getCamera, getTilt, getWorldPose, pose, overhead };
  const paintPose = useRef<(() => void) | null>(null);
  // Travel can finish between two slow animation frames. Paint a pose change
  // immediately at commit so the actor stands for even a short movement.
  useLayoutEffect(() => { paintPose.current?.(); }, [pose, expression]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const assets: Record<string, string> = { ...battleSpriteAssets(artStyle), ...BANKS_SPRITE_ASSETS, ...HERO_EXPRESSION_ASSETS, ...(actorId === 'hero' && artStyle === 'paint' ? OPENING_HERO_ASSETS : {}) };
    const painted = artStyle === 'paint' || actorId === 'banks';
    let stopped = false, frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let library: ReturnType<typeof createDirectionalSpriteLibrary> | undefined;
    let actor: ReturnType<ReturnType<typeof createDirectionalSpriteLibrary>['create']> | undefined;
    const textures: THREE.Texture[] = [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let previous = { ...live.current.position };
    let walkTime = 0;
    const start = async () => {
      try {
        const entries = await Promise.all((actorId === 'banks' ? Object.keys(BANKS_SPRITE_ASSETS) : actorId === 'mochi' ? ['mochiLow', 'mochiHigh'] : ['heroLow', 'heroHigh', 'heroSittingLow', 'heroSittingHigh', 'heroWalkingLow', 'heroWalkingHigh', ...(artStyle === 'paint' ? [...['heroLow','heroHigh','heroSittingLow','heroSittingHigh','heroWalkingLow','heroWalkingHigh'].map(key=>key+'Bobtail')] : [])]).map(async key => {
          const texture = await loadMediaTexture(`${import.meta.env.BASE_URL}assets/${assets[key]}`);
          textures.push(texture); texture.colorSpace = THREE.SRGBColorSpace;
          texture.magFilter = painted ? THREE.LinearFilter : THREE.NearestFilter; texture.minFilter = texture.magFilter;
          texture.userData.watercolor = painted;
          texture.generateMipmaps = false;
          if (stopped) texture.dispose();
          return [key, texture] as const;
        }));
        if (actorId === 'hero' && painted) {
          for (const key of Object.keys(OPENING_HERO_ASSETS).filter(key => key.endsWith('Joyful'))) {
            const texture = await loadMediaTexture(`${import.meta.env.BASE_URL}assets/${assets[key]}`);
            texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.LinearFilter;
            texture.generateMipmaps = false; texture.userData.watercolor = true;
            textures.push(texture); entries.push([key, texture]);
          }
          for (const key of Object.keys(HERO_EXPRESSION_ASSETS)) {
            const texture = await loadMediaTexture(`${import.meta.env.BASE_URL}assets/${assets[key]}`);
            texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.LinearFilter;
            texture.generateMipmaps = false; texture.userData.watercolor = true;
            textures.push(texture); entries.push([key, texture]);
          }
        }
        if (stopped) { textures.forEach(texture => texture.dispose()); return; }
        // Peek openings reveal this original live canvas in the depth scene;
        // no pixel copy/readback or preserved drawing buffer is needed.
        // CSS can re-composite this small canvas between sprite frames while
        // orbiting. Retain its last completed image instead of a cleared buffer.
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
        renderer.setSize(192, 192, false); renderer.setClearColor(0, 0);
        renderer.domElement.style.cssText = `width:100%;height:100%;image-rendering:${painted ? 'auto' : 'pixelated'};pointer-events:none`;
        host.current?.append(renderer.domElement);
        const scene = new THREE.Scene();
        const display = new THREE.OrthographicCamera(-.65, .65, overhead ? .65 : 1.25, overhead ? -.65 : -.05, .1, 100);
        display.position.set(0, 0, 10); display.lookAt(0, 0, 0);
        const eye = new THREE.PerspectiveCamera();
        library = createDirectionalSpriteLibrary(Object.fromEntries(entries), actorId === 'banks' ? BANKS_DIRECTIONAL_SPRITE : actorId === 'mochi' ? MOCHI_DIRECTIONAL_SPRITE : HERO_DIRECTIONAL_SPRITE, actorId === 'banks' ? BANKS_POSES : actorId === 'mochi' ? {} : { sitting: HERO_SITTING_DIRECTIONAL_SPRITE, walking: HERO_WALKING_DIRECTIONAL_SPRITE });
        actor = library.create(1); scene.add(actor.root);
        const paint = (now: number, schedule = true) => {
          if (stopped || !actor || !renderer) return;
          const input = live.current, worldPose = input.getWorldPose?.();
          const { getCamera: cameraNow, getTilt: tiltNow, pose: currentPose, overhead: above } = input;
          const point = worldPose?.position ?? input.position, worldHeading = worldPose?.heading ?? input.heading;
          const dx = point.x - previous.x, dz = point.y - previous.y;
          const moving = Math.hypot(dx, dz) > .001;
          // Advance by ground distance so pace changes never restart the gait.
          if (currentPose === 'walking') walkTime += Math.hypot(dx, dz) / HERO_WALK_STRIDE * (4 / HERO_WALKING_DIRECTIONAL_SPRITE.animation!.fps);
          previous = { ...point };
          const camera = cameraNow(), p = tableSpriteEye(camera, tiltNow(camera), point);
          if(display.top !== (above ? .65 : 1.25)) {display.top=above ? .65 : 1.25;display.bottom=above ? -.65 : -.05;display.updateProjectionMatrix();}
          eye.position.set(above ? 0 : p.x, above ? 100 : p.y, above ? 0 : p.z);
          actor.setPose(actorId === 'mochi' ? 'standing' : currentPose);
          actor.setExpression(expressionRef.current);
          actor.update(eye, worldHeading, currentPose === 'walking' ? walkTime : now / 1000, reduced.matches, 0, moving ? 1 : 0, now / 1000);
          // CSS already cancels the table tilt/spin. Avoid applying a second
          // camera projection to the local sprite canvas.
          actor.billboard.rotation.set(0, 0, 0);
          renderer.domElement.dataset.spriteFrame = actor.frame;
          renderer.domElement.dataset.spritePose = actor.pose;
          renderer.domElement.dataset.animationFrame = String(actor.animationFrame);
          renderer.domElement.dataset.worldHeading = String(worldHeading);
          renderer.domElement.dataset.actorExpression = expressionRef.current ?? 'neutral';
          renderer.domElement.dataset.faceLayer = String(actor.faceLayer?.visible ?? false);
          renderer.render(scene, display);
          if (schedule) frame = gameTime.requestAnimationFrame(paint);
        };
        paintPose.current = () => paint(gameTime.now(), false);
        paint(gameTime.now()); setReady(true);
      } catch { textures.forEach(texture => texture.dispose()); }
    };
    void start();
    return () => { stopped = true; paintPose.current = null; gameTime.cancelAnimationFrame(frame); actor?.dispose(); library?.dispose();
      textures.forEach(texture => texture.dispose()); renderer?.dispose(); renderer?.domElement.remove(); };
  }, [artStyle, actorId]);
  return <span ref={host} aria-hidden="true" data-table-sectional-sprite={actorId} data-art-style={artStyle}
    style={{ display: 'block', width: '100%', height: '100%', transform: overhead ? 'scale(1.3)' : undefined, filter: `brightness(${brightness})` }}>
    {!ready && fallback}
  </span>;
}
