import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { BATTLE_SPRITE_ASSETS } from '../battleSpriteAssets';
import { createDirectionalSpriteLibrary } from '../directionalSpriteRig';
import { HERO_DIRECTIONAL_SPRITE } from '../directionalSprites';
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
export function TableActorSprite({ position, heading, getCamera, getTilt, fallback, brightness = 1 }:
  { position: { x: number; y: number }; heading: number; getCamera: () => Camera; getTilt: (camera: Camera) => TableTilt; fallback: ReactNode; brightness?: number }) {
  const host = useRef<HTMLSpanElement>(null);
  const live = useRef({ position, heading, getCamera, getTilt }); live.current = { position, heading, getCamera, getTilt };
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stopped = false, frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let library: ReturnType<typeof createDirectionalSpriteLibrary> | undefined;
    let actor: ReturnType<ReturnType<typeof createDirectionalSpriteLibrary>['create']> | undefined;
    const textures: THREE.Texture[] = [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let previous = { ...live.current.position };
    const start = async () => {
      try {
        const loader = new THREE.TextureLoader();
        const entries = await Promise.all(['heroLow', 'heroHigh'].map(async key => {
          const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/${BATTLE_SPRITE_ASSETS[key]}`);
          textures.push(texture); texture.colorSpace = THREE.SRGBColorSpace;
          texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
          texture.generateMipmaps = false;
          if (stopped) texture.dispose();
          return [key, texture] as const;
        }));
        if (stopped) return;
        // The shared occlusion pass copies this small live canvas without
        // allocating a second rig. Keep its pixels available after compositing.
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
        renderer.setSize(192, 192, false); renderer.setClearColor(0, 0);
        renderer.domElement.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;pointer-events:none';
        host.current?.append(renderer.domElement);
        const scene = new THREE.Scene();
        const display = new THREE.OrthographicCamera(-.65, .65, 1.25, -.05, .1, 100);
        display.position.set(0, 0, 10); display.lookAt(0, 0, 0);
        const eye = new THREE.PerspectiveCamera();
        library = createDirectionalSpriteLibrary(Object.fromEntries(entries), HERO_DIRECTIONAL_SPRITE);
        actor = library.create(1); scene.add(actor.root);
        const paint = (now: number) => {
          if (stopped || !actor || !renderer) return;
          const { position: point, heading: worldHeading, getCamera: cameraNow, getTilt: tiltNow } = live.current;
          const dx = point.x - previous.x, dz = point.y - previous.y;
          const moving = Math.hypot(dx, dz) > .001;
          previous = { ...point };
          const camera = cameraNow(), p = tableSpriteEye(camera, tiltNow(camera), point);
          eye.position.set(p.x, p.y, p.z);
          actor.update(eye, worldHeading, now / 1000, reduced.matches, 0, moving ? 1 : 0);
          // CSS already cancels the table tilt/spin. Avoid applying a second
          // camera projection to the local sprite canvas.
          actor.billboard.rotation.set(0, 0, 0);
          renderer.domElement.dataset.spriteFrame = actor.frame;
          renderer.domElement.dataset.worldHeading = String(worldHeading);
          renderer.render(scene, display);
          frame = requestAnimationFrame(paint);
        };
        paint(performance.now()); setReady(true);
      } catch { textures.forEach(texture => texture.dispose()); }
    };
    void start();
    return () => { stopped = true; cancelAnimationFrame(frame); actor?.dispose(); library?.dispose();
      textures.forEach(texture => texture.dispose()); renderer?.dispose(); renderer?.domElement.remove(); };
  }, []);
  return <span ref={host} aria-hidden="true" data-table-sectional-sprite="hero"
    style={{ display: 'block', width: '100%', height: '100%', filter: `brightness(${brightness})` }}>
    {!ready && fallback}
  </span>;
}
