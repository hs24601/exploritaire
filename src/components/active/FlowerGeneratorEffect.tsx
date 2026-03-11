import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

const FLOWER_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const FLOWER_FRAGMENT_SHADER = `
#define PI 3.14159265359

uniform float u_ratio;
uniform float u_moving;
uniform float u_stop_time;
uniform float u_speed;
uniform vec2 u_stop_randomizer;
uniform float u_clean;
uniform vec2 u_point;
uniform vec2 u_flower_point;
uniform float u_flower_scale;
uniform vec3 u_flower_tint;
uniform vec3 u_stem_tint;
uniform float u_blue_floor;
uniform float u_blue_ceiling;
uniform sampler2D u_texture;
varying vec2 vUv;

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 n) {
  const vec2 d = vec2(0.0, 1.0);
  vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
  return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
}

float flower_shape(vec2 _point, float _size, float _outline, float _tickniess, float _noise, float _angle_offset) {
  float random_by_uv = noise(vUv);

  float petals_thickness = 0.5;
  float petals_number = 5.0 + floor(u_stop_randomizer[0] * 4.0);
  float angle_animated_offset = 0.7 * (random_by_uv - 0.5) / (1.0 + 30.0 * u_stop_time);
  float flower_angle = atan(_point.y, _point.x) - angle_animated_offset;
  float flower_sectoral_shape = abs(sin(flower_angle * 0.5 * petals_number + _angle_offset)) + _tickniess * petals_thickness;

  vec2 flower_size_range = vec2(4.0, 18.0);
  float flower_radial_shape = length(_point) * (flower_size_range[0] + flower_size_range[1] * u_stop_randomizer[0]);
  float radius_noise = sin(flower_angle * 13.0 + 15.0 * random_by_uv);
  flower_radial_shape += _noise * radius_noise;

  float flower_radius_grow = min(20000.0 * u_stop_time, 1.0);
  flower_radius_grow = 1.0 / flower_radius_grow;

  float shape = 1.0 - smoothstep(0.0, _size * flower_sectoral_shape, _outline * flower_radius_grow * flower_radial_shape);
  shape *= (1.0 - u_moving);
  shape *= (1.0 - step(1.0, u_stop_time));

  return shape;
}

void main() {
  vec3 base = texture2D(u_texture, vUv).xyz;
  vec2 cursor = vUv - u_point.xy;
  vec2 flower_cursor = vUv - u_flower_point.xy;
  cursor.x *= u_ratio;
  flower_cursor.x *= u_ratio;

  vec3 stem_color = u_stem_tint;
  float stem_radius = 0.003 * u_speed * u_moving;
  float stem_shape = 1.0 - pow(smoothstep(0.0, stem_radius, dot(cursor, cursor)), 0.03);
  vec3 stem = stem_shape * stem_color;

  vec3 flower_color = vec3(0.7 + u_stop_randomizer[1], 0.8 * u_stop_randomizer[1], 2.9 + u_stop_randomizer[0] * 0.6);
  vec3 flower_new = (flower_color * u_flower_tint) * flower_shape(flower_cursor, 1.0 * u_flower_scale, 0.96, 1.0, 0.15, 0.0);
  vec3 flower_mask = 1.0 - vec3(flower_shape(flower_cursor, 1.05 * u_flower_scale, 1.07, 1.0, 0.15, 0.0));
  vec3 flower_mid = vec3(-0.6) * flower_shape(flower_cursor, 0.15 * u_flower_scale, 1.0, 2.0, 0.1, 1.9);

  vec3 color = base * flower_mask + (flower_new + flower_mid + stem);
  color *= u_clean;
  color = clamp(color, vec3(0.0, 0.0, u_blue_floor), vec3(1.0, 1.0, u_blue_ceiling));

  gl_FragColor = vec4(color, 1.0);
}
`;

type Props = {
  className?: string;
  config?: FlowerGeneratorConfig;
};

export type FlowerGeneratorConfig = {
  enableHoverTrail: boolean;
  trailPollMs: number;
  trailSizeVariance: number;
  flowerScale: number;
  flowerTint: string;
  stemColor: string;
  blueFloor: number;
  blueCeiling: number;
};

export const DEFAULT_FLOWER_GENERATOR_CONFIG: FlowerGeneratorConfig = {
  enableHoverTrail: true,
  trailPollMs: 36,
  trailSizeVariance: 0.35,
  flowerScale: 1,
  flowerTint: '#ffffff',
  stemColor: '#00ffcc',
  blueFloor: 0,
  blueCeiling: 0.4,
};

function hexToVec3(hex: string) {
  const color = new THREE.Color(hex);
  return new THREE.Vector3(color.r, color.g, color.b);
}

export const FlowerGeneratorEffect = memo(function FlowerGeneratorEffect({ className, config = DEFAULT_FLOWER_GENERATOR_CONFIG }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanRef = useRef<() => void>(() => {});
  const configRef = useRef<FlowerGeneratorConfig>(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pointer = {
      x: 0.5,
      y: 0.65,
      moved: false,
      speed: 1.0,
      vanishCanvas: false,
      eventType: 'none' as 'none' | 'click' | 'trail',
    };
    let lastTrailStamp = 0;
    const flowerPoint = { x: pointer.x, y: pointer.y };

    let vanishTimer: number | null = null;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);

    const sceneShader = new THREE.Scene();
    const sceneBasic = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    const clock = new THREE.Clock();

    let shaderMaterial: THREE.ShaderMaterial | null = null;
    let basicMaterial: THREE.MeshBasicMaterial | null = null;
    let planeGeometry: THREE.PlaneGeometry | null = null;
    let renderTargets = [
      new THREE.WebGLRenderTarget(1, 1),
      new THREE.WebGLRenderTarget(1, 1),
    ];

    const cleanCanvas = () => {
      pointer.vanishCanvas = true;
      if (vanishTimer !== null) window.clearTimeout(vanishTimer);
      vanishTimer = window.setTimeout(() => {
        pointer.vanishCanvas = false;
      }, 50);
    };
    cleanRef.current = cleanCanvas;

    const createPlane = () => {
      shaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
          u_stop_time: { value: 0 },
          u_point: { value: new THREE.Vector2(pointer.x, pointer.y) },
          u_flower_point: { value: new THREE.Vector2(flowerPoint.x, flowerPoint.y) },
          u_moving: { value: 0 },
          u_speed: { value: 0 },
          u_stop_randomizer: { value: new THREE.Vector2(Math.random(), Math.random()) },
          u_clean: { value: 1 },
          u_ratio: { value: 1 },
          u_flower_scale: { value: configRef.current.flowerScale },
          u_flower_tint: { value: hexToVec3(configRef.current.flowerTint) },
          u_stem_tint: { value: hexToVec3(configRef.current.stemColor) },
          u_blue_floor: { value: configRef.current.blueFloor },
          u_blue_ceiling: { value: configRef.current.blueCeiling },
          u_texture: { value: null },
        },
        vertexShader: FLOWER_VERTEX_SHADER,
        fragmentShader: FLOWER_FRAGMENT_SHADER,
      });

      basicMaterial = new THREE.MeshBasicMaterial();
      planeGeometry = new THREE.PlaneGeometry(2, 2);
      const planeBasic = new THREE.Mesh(planeGeometry, basicMaterial);
      const planeShader = new THREE.Mesh(planeGeometry, shaderMaterial);
      sceneBasic.add(planeBasic);
      sceneShader.add(planeShader);
    };

    const clearRenderTargets = () => {
      const oldTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(renderTargets[0]);
      renderer.clearColor();
      renderer.setRenderTarget(renderTargets[1]);
      renderer.clearColor();
      renderer.setRenderTarget(oldTarget);
    };

    const updateSize = () => {
      if (!shaderMaterial) return;
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);

      renderTargets[0].dispose();
      renderTargets[1].dispose();
      renderTargets = [
        new THREE.WebGLRenderTarget(width, height),
        new THREE.WebGLRenderTarget(width, height),
      ];

      shaderMaterial.uniforms.u_ratio.value = width / height;
      clearRenderTargets();
    };

    const spawnFlowerAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      pointer.x = Math.max(0, Math.min(1, x));
      pointer.y = Math.max(0, Math.min(1, y));
      flowerPoint.x = pointer.x;
      flowerPoint.y = pointer.y;
      pointer.speed = 1.1;
      pointer.moved = true;
      pointer.eventType = 'click';
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      spawnFlowerAt(event.clientX, event.clientY);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!configRef.current.enableHoverTrail) return;
      const now = performance.now();
      if (now - lastTrailStamp < Math.max(1, configRef.current.trailPollMs)) return;
      lastTrailStamp = now;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = (event.clientY - rect.top) / rect.height;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
      const dx = 12 * (nx - pointer.x);
      const dy = 12 * (ny - pointer.y);
      const variance = Math.max(0, configRef.current.trailSizeVariance);
      const sizeJitter = 1 + ((Math.random() * 2 - 1) * variance);
      pointer.x = nx;
      pointer.y = ny;
      pointer.speed = Math.min(2, ((dx * dx) + (dy * dy)) * sizeJitter);
      pointer.moved = true;
      pointer.eventType = 'trail';
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 1) return;
      const touch = event.touches[0];
      spawnFlowerAt(touch.clientX, touch.clientY);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') cleanCanvas();
    };

    createPlane();
    updateSize();

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('resize', updateSize);
    window.addEventListener('keydown', onKeyDown);

    let rafId = 0;
    const render = () => {
      if (!shaderMaterial || !basicMaterial) return;
      shaderMaterial.uniforms.u_flower_scale.value = configRef.current.flowerScale;
      shaderMaterial.uniforms.u_flower_tint.value.copy(hexToVec3(configRef.current.flowerTint));
      shaderMaterial.uniforms.u_stem_tint.value.copy(hexToVec3(configRef.current.stemColor));
      shaderMaterial.uniforms.u_blue_floor.value = configRef.current.blueFloor;
      shaderMaterial.uniforms.u_blue_ceiling.value = configRef.current.blueCeiling;

      shaderMaterial.uniforms.u_clean.value = pointer.vanishCanvas ? 0 : 1;
      shaderMaterial.uniforms.u_point.value.set(pointer.x, 1 - pointer.y);
      shaderMaterial.uniforms.u_flower_point.value.set(flowerPoint.x, 1 - flowerPoint.y);
      shaderMaterial.uniforms.u_texture.value = renderTargets[0].texture;
      shaderMaterial.uniforms.u_ratio.value = Math.max(0.1, canvas.clientWidth / Math.max(1, canvas.clientHeight));

      if (pointer.moved) {
        shaderMaterial.uniforms.u_moving.value = 1;
        if (pointer.eventType === 'click') {
          shaderMaterial.uniforms.u_stop_randomizer.value.set(Math.random(), Math.random());
          if (canvas.clientWidth < 650) {
            shaderMaterial.uniforms.u_stop_randomizer.value.x *= 0.2;
            shaderMaterial.uniforms.u_stop_randomizer.value.x += 0.8;
          }
          shaderMaterial.uniforms.u_stop_time.value = 0;
        }
        pointer.moved = false;
        pointer.eventType = 'none';
      } else {
        shaderMaterial.uniforms.u_moving.value = 0;
      }

      shaderMaterial.uniforms.u_stop_time.value += clock.getDelta();
      shaderMaterial.uniforms.u_speed.value = pointer.speed;

      renderer.setRenderTarget(renderTargets[1]);
      renderer.render(sceneShader, camera);

      basicMaterial.map = renderTargets[1].texture;
      renderer.setRenderTarget(null);
      renderer.render(sceneBasic, camera);

      const tmp = renderTargets[0];
      renderTargets[0] = renderTargets[1];
      renderTargets[1] = tmp;

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      if (vanishTimer !== null) window.clearTimeout(vanishTimer);
      cleanRef.current = () => {};
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('keydown', onKeyDown);

      renderTargets[0].dispose();
      renderTargets[1].dispose();
      shaderMaterial?.dispose();
      basicMaterial?.dispose();
      planeGeometry?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className={`w-full h-full bg-black/80 flex items-center justify-center p-10 ${className ?? ''}`}>
      <div className="relative w-full h-full border border-game-teal/20 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
        <button
          type="button"
          onClick={() => cleanRef.current()}
          className="absolute left-3 bottom-3 z-10 text-[11px] font-mono underline text-game-white/80 hover:text-game-white"
        >
          clean the screen
        </button>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: flower_generator (left click to spawn)</div>
        </div>
      </div>
    </div>
  );
});
