import { memo, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import type { CSSProperties } from 'react';
import type { WatercolorConfig } from './types';
import { useWatercolorEnabled } from './useWatercolorEnabled';

interface WatercolorOverlayProps {
  config: WatercolorConfig;
  className?: string;
  style?: CSSProperties;
}

export interface WatercolorOverlayHandle {
  getBlooms: () => Bloom[];
}

type Bloom = {
  x: number;
  y: number;
  size: number;
  color: [number, number, number];
  intensity: number;
  shape: number; // 0 = circle, 1 = rectangle, 2 = hollow-rect
  innerSize: number;
  innerFeather: number;
};

type RendererType = 'webgl2' | 'webgl' | 'canvas2d' | 'none';

type Renderer = {
  type: RendererType;
  render: (timeSeconds: number, blooms: Bloom[], grain: WatercolorConfig['grain'], glowStrength: number) => void;
  resize: (width: number, height: number, dpr: number) => void;
  dispose: () => void;
};

type OverlayRegistration = {
  canvas: HTMLCanvasElement;
  getBlooms: () => Bloom[];
  getGrain: () => WatercolorConfig['grain'];
  getGlowStrength: () => number;
  getActive: () => boolean;
  clear: () => void;
  ctx: CanvasRenderingContext2D | null;
};

const MAX_BLOOMS = 64;
const BASE_FRAME_INTERVAL_MS = 1000 / 60;
const DRAG_DEGRADED_MIN_FRAME_INTERVAL_MS = 1000 / 22;
const WE_DRAG_DEGRADE_DISABLE_KEY = 'exploritaire.we.dragDegradeDisabled';
const DRAG_GLOW_FACTOR = 0.45;
const DRAG_GRAIN_INTENSITY_FACTOR = 0.55;
const DRAG_GRAIN_FREQUENCY_FACTOR = 0.85;
const MAX_OVERLAYS_WHILE_DRAG_DEGRADED = 18;

let watercolorInteractionDegraded = false;

function getFrameIntervalMs(overlayCount: number): number {
  if (overlayCount >= 40) return 1000 / 24;
  if (overlayCount >= 20) return 1000 / 30;
  return BASE_FRAME_INTERVAL_MS;
}

function isOverlayRenderable(overlay: OverlayRegistration): boolean {
  const canvas = overlay.canvas;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth <= 1 || cssHeight <= 1) return false;

  // Fast reject when detached/hidden via layout (except fixed overlays).
  if (canvas.offsetParent === null) {
    const style = window.getComputedStyle(canvas);
    if (style.position !== 'fixed') return false;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 1 || rect.height <= 1) return false;
  if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
  if (rect.right < 0 || rect.left > window.innerWidth) return false;
  return true;
}

function readDragDegradeDisabledFlag(): boolean {
  if (typeof window === 'undefined') return false;
  const globalOverride = (window as any).__EXPLORITAIRE_DISABLE_WE_DRAG_DEGRADE__;
  if (typeof globalOverride === 'boolean') return globalOverride;
  try {
    return window.localStorage.getItem(WE_DRAG_DEGRADE_DISABLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWatercolorInteractionDegraded(enabled: boolean) {
  watercolorInteractionDegraded = enabled;
  ensureOverlayLoop();
}

export function setWatercolorDragDegradeDisabled(disabled: boolean) {
  if (typeof window !== 'undefined') {
    (window as any).__EXPLORITAIRE_DISABLE_WE_DRAG_DEGRADE__ = disabled;
    try {
      if (disabled) {
        window.localStorage.setItem(WE_DRAG_DEGRADE_DISABLE_KEY, '1');
      } else {
        window.localStorage.removeItem(WE_DRAG_DEGRADE_DISABLE_KEY);
      }
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }
  ensureOverlayLoop();
}

export function isWatercolorDragDegradeDisabled(): boolean {
  return readDragDegradeDisabledFlag();
}

const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec4 uBlooms[${MAX_BLOOMS}]; // x, y, size, intensity
  uniform vec3 uColors[${MAX_BLOOMS}]; // r, g, b
  uniform float uShapes[${MAX_BLOOMS}]; // 0 = circle, 1 = rectangle, 2 = hollow-rect
  uniform vec2 uInnerParams[${MAX_BLOOMS}]; // innerSize, innerFeather
  uniform int uBloomCount;
  uniform float uGrainIntensity;
  uniform float uGrainFrequency;
  uniform float uGlowStrength;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  // Signed distance to rounded rectangle (centered at origin)
  float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;

    vec3 color = vec3(0.0);
    float totalAlpha = 0.0;

    for (int i = 0; i < ${MAX_BLOOMS}; i++) {
      if (i >= uBloomCount) break;

      vec4 bloom = uBlooms[i];
      vec2 bloomPos = bloom.xy;
      float size = bloom.z; // Now represents full coverage at 1.0
      float intensity = bloom.w;
      float shape = uShapes[i];
      vec2 innerParams = uInnerParams[i];

      float d;

      if (shape > 0.5) {
        // Rectangle shape - centered, with bleed
        vec2 p = uv - 0.5 + (bloomPos - 0.5) * 0.2;
        vec2 rectSize = vec2(0.5, 0.5) * size; // Size 1.0 = fills container
        float cornerRadius = 0.04 * size;
        d = sdRoundedBox(p, rectSize, cornerRadius);

        // Add organic edge noise for watercolor bleed
        float edgeNoise = noise(uv * 10.0 + uTime * 0.1) * 0.06;
        edgeNoise += noise(uv * 20.0 - uTime * 0.05) * 0.03;
        d += edgeNoise;
      } else {
        // Circle shape
        vec2 p = uv;
        p.x *= aspect;
        vec2 bPos = bloomPos;
        bPos.x *= aspect;
        d = distance(p, bPos) - size * 0.5;

        // Add noise for organic edges
        float n = noise(uv * 6.0 + uTime * 0.15);
        d += n * 0.06 * size;
      }

      // Soft watercolor falloff
      float bloomAlpha = smoothstep(0.08, -0.12, d) * intensity;

      if (shape > 1.5) {
        // Hollow rectangle: subtract inner region with organic edge
        vec2 p = uv - 0.5 + (bloomPos - 0.5) * 0.2;
        vec2 rectSize = vec2(0.5, 0.5) * size;
        float cornerRadius = 0.04 * size;
        float innerSize = clamp(innerParams.x, 0.1, 0.95);
        float innerFeather = clamp(innerParams.y, 0.0, 0.3);
        vec2 innerRect = rectSize * innerSize;
        float innerRadius = cornerRadius * innerSize;
        float dInner = sdRoundedBox(p, innerRect, innerRadius);
        float innerEdgeNoise = noise(uv * 10.0 + uTime * 0.1) * 0.06;
        innerEdgeNoise += noise(uv * 20.0 - uTime * 0.05) * 0.03;
        dInner += innerEdgeNoise * (0.6 + innerFeather);
        float innerMask = smoothstep(0.0425 + innerFeather * 0.2, -0.07 - innerFeather * 0.2, dInner);
        float innerCut = step(0.4, innerMask);
        bloomAlpha *= (1.0 - innerCut);
      }

      // Edge darkening for watercolor pooling effect
      float edge = smoothstep(0.02, -0.01, d) * smoothstep(-0.1, -0.03, d) * 0.5;

      vec3 pigment = uColors[i];
      color = mix(color, pigment, bloomAlpha);
      color = mix(color, pigment * 0.85, edge * intensity);
      float glow = bloomAlpha * uGlowStrength;
      color += pigment * glow;
      totalAlpha = max(totalAlpha, bloomAlpha + glow * 0.35);
    }

    // Strong alpha output
    totalAlpha = min(totalAlpha * 1.8, 0.9);

    // Watercolor grain texture
    float grain = noise(uv * (uGrainFrequency * 400.0)) * uGrainIntensity;
    float grain2 = noise(uv * (uGrainFrequency * 150.0)) * uGrainIntensity * 0.6;
    color -= (grain + grain2) * 0.35;

    gl_FragColor = vec4(color, totalAlpha);
  }
`;

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function buildBlooms(config: WatercolorConfig): Bloom[] {
  const blooms: Bloom[] = [];
  config.splotches.forEach((splotch) => {
    const [r, g, b] = hexToRgb(splotch.gradient.mid);
    const intensity = clamp01(splotch.opacity * splotch.gradient.midOpacity);
    const scale = config.overallScale;
    const splotchScale = splotch.scale * scale;
    const offsetX = splotch.offset[0] * scale;
    const offsetY = splotch.offset[1] * scale;
    const shapeNum = splotch.shape === 'rectangle' ? 1 : splotch.shape === 'hollow-rect' ? 2 : 0;

    // Scale 1.0 = fills container, 1.5 = 1.5x container size
    const size = splotchScale;
    const x = 0.5 + offsetX;
    const y = 0.5 + offsetY;
    blooms.push({
      x,
      y,
      size,
      color: [r, g, b],
      intensity,
      shape: shapeNum,
      innerSize: splotch.innerSize ?? 0.6,
      innerFeather: splotch.innerFeather ?? 0.12,
    });
  });
  // Render higher-priority (lower index) splotches on top.
  const ordered = blooms.reverse();
  return ordered.slice(0, MAX_BLOOMS);
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createWebglRenderer(canvas: HTMLCanvasElement): Renderer {
  const gl = canvas.getContext('webgl2', { alpha: true }) || canvas.getContext('webgl', { alpha: true });
  if (!gl) {
    return createCanvas2dRenderer(canvas);
  }

  const isWebgl2 = (gl as WebGL2RenderingContext).TEXTURE_3D !== undefined;
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) {
    return createCanvas2dRenderer(canvas);
  }

  const program = gl.createProgram();
  if (!program) {
    return createCanvas2dRenderer(canvas);
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return createCanvas2dRenderer(canvas);
  }

  gl.useProgram(program);

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const uTimeLoc = gl.getUniformLocation(program, 'uTime');
  const uResLoc = gl.getUniformLocation(program, 'uResolution');
  const uBloomsLoc = gl.getUniformLocation(program, 'uBlooms');
  const uColorsLoc = gl.getUniformLocation(program, 'uColors');
  const uShapesLoc = gl.getUniformLocation(program, 'uShapes');
  const uInnerParamsLoc = gl.getUniformLocation(program, 'uInnerParams');
  const uCountLoc = gl.getUniformLocation(program, 'uBloomCount');
  const uGrainIntensityLoc = gl.getUniformLocation(program, 'uGrainIntensity');
  const uGrainFrequencyLoc = gl.getUniformLocation(program, 'uGrainFrequency');
  const uGlowStrengthLoc = gl.getUniformLocation(program, 'uGlowStrength');

  const render = (timeSeconds: number, blooms: Bloom[], grain: WatercolorConfig['grain'], glowStrength: number) => {
    if (!uTimeLoc || !uResLoc || !uBloomsLoc || !uColorsLoc || !uCountLoc || !uGrainIntensityLoc || !uGrainFrequencyLoc) {
      return;
    }

    const bloomData = arrayPool.acquire(MAX_BLOOMS * 4);
    const colorData = arrayPool.acquire(MAX_BLOOMS * 3);
    const shapesData = arrayPool.acquire(MAX_BLOOMS);
    const bloomCount = Math.min(blooms.length, MAX_BLOOMS);
    const innerData = arrayPool.acquire(MAX_BLOOMS * 2);

    for (let i = 0; i < bloomCount; i += 1) {
      const bloom = blooms[i];
      const idx4 = i * 4;
      bloomData[idx4] = bloom.x;
      bloomData[idx4 + 1] = 1.0 - bloom.y;
      bloomData[idx4 + 2] = bloom.size;
      bloomData[idx4 + 3] = bloom.intensity;

      const idx3 = i * 3;
      colorData[idx3] = bloom.color[0];
      colorData[idx3 + 1] = bloom.color[1];
      colorData[idx3 + 2] = bloom.color[2];

      shapesData[i] = bloom.shape;
      const idx2 = i * 2;
      innerData[idx2] = bloom.innerSize ?? 0.6;
      innerData[idx2 + 1] = bloom.innerFeather ?? 0.12;
    }

    gl.uniform1f(uTimeLoc, timeSeconds);
    gl.uniform3fv(uColorsLoc, colorData);
    gl.uniform4fv(uBloomsLoc, bloomData);
    if (uShapesLoc) {
      gl.uniform1fv(uShapesLoc, shapesData);
    }
    if (uInnerParamsLoc) {
      gl.uniform2fv(uInnerParamsLoc, innerData);
    }
    gl.uniform1i(uCountLoc, bloomCount);
    gl.uniform1f(uGrainIntensityLoc, grain.enabled ? grain.intensity : 0);
    gl.uniform1f(uGrainFrequencyLoc, grain.frequency);
    if (uGlowStrengthLoc) {
      gl.uniform1f(uGlowStrengthLoc, glowStrength);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Return arrays to pool for reuse
    arrayPool.release(bloomData);
    arrayPool.release(colorData);
    arrayPool.release(shapesData);
    arrayPool.release(innerData);
  };

  const resize = (width: number, height: number, dpr: number) => {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uResLoc) {
      gl.uniform2f(uResLoc, canvas.width, canvas.height);
    }
  };

  const dispose = () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  };

  return {
    type: isWebgl2 ? 'webgl2' : 'webgl',
    render,
    resize,
    dispose,
  };
}

function createCanvas2dRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      type: 'none',
      render: () => {},
      resize: () => {},
      dispose: () => {},
    };
  }

  const render = (_timeSeconds: number, blooms: Bloom[], grain: WatercolorConfig['grain'], glowStrength: number) => {
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // No background fill - keep transparent like WebGL version

    blooms.forEach((bloom) => {
      const x = bloom.x * width;
      const y = bloom.y * height;
      const radius = bloom.size * Math.min(width, height);
      const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
      gradient.addColorStop(0, `rgba(${Math.round(bloom.color[0] * 255)}, ${Math.round(bloom.color[1] * 255)}, ${Math.round(bloom.color[2] * 255)}, ${0.6 * bloom.intensity})`);
      gradient.addColorStop(1, `rgba(${Math.round(bloom.color[0] * 255)}, ${Math.round(bloom.color[1] * 255)}, ${Math.round(bloom.color[2] * 255)}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (glowStrength > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = Math.max(4, radius * 0.5 * glowStrength);
        ctx.shadowColor = `rgba(${Math.round(bloom.color[0] * 255)}, ${Math.round(bloom.color[1] * 255)}, ${Math.round(bloom.color[2] * 255)}, ${0.6 * glowStrength})`;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * (1 + glowStrength * 0.2), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    if (grain.enabled && grain.intensity > 0) {
      // Subtle grain overlay - use darker tones that blend with watercolor
      const grainSize = 4;
      const grainAlpha = Math.min(0.15, grain.intensity * 0.5);
      for (let i = 0; i < width; i += grainSize) {
        for (let j = 0; j < height; j += grainSize) {
          // Mix of dark and light grain for texture without washing out color
          const isDark = Math.random() > 0.5;
          const shade = isDark ? Math.floor(20 + Math.random() * 40) : Math.floor(200 + Math.random() * 55);
          ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${grainAlpha})`;
          ctx.fillRect(i, j, grainSize, grainSize);
        }
      }
    }
  };

  const resize = (width: number, height: number, dpr: number) => {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  };

  return {
    type: 'canvas2d',
    render,
    resize,
    dispose: () => {},
  };
}

type SharedRenderer = {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  dispose: () => void;
};

let sharedRenderer: SharedRenderer | null = null;
let overlayLoopHandle: number | null = null;
let lastFrameTime = 0;
const overlays = new Set<OverlayRegistration>();

// Typed array pool to reduce GC pressure
class TypedArrayPool {
  private floatArrays: Map<number, Float32Array[]> = new Map();

  acquire(size: number): Float32Array {
    const key = size;
    if (!this.floatArrays.has(key)) {
      this.floatArrays.set(key, []);
    }
    const pool = this.floatArrays.get(key)!;
    const array = pool.pop();
    if (array) {
      // Zero out the array before reusing
      array.fill(0);
      return array;
    }
    return new Float32Array(size);
  }

  release(array: Float32Array) {
    const key = array.length;
    if (!this.floatArrays.has(key)) {
      this.floatArrays.set(key, []);
    }
    const pool = this.floatArrays.get(key)!;
    // Keep up to 10 arrays of each size in the pool
    if (pool.length < 10) {
      pool.push(array);
    }
  }
}

const arrayPool = new TypedArrayPool();

function getSharedRenderer(): SharedRenderer {
  if (sharedRenderer) return sharedRenderer;
  const canvas = document.createElement('canvas');
  const renderer = createWebglRenderer(canvas);
  const dispose = () => {
    renderer.dispose();
  };
  sharedRenderer = { canvas, renderer, dispose };
  return sharedRenderer;
}

function releaseSharedRenderer() {
  if (!sharedRenderer) return;
  sharedRenderer.dispose();
  sharedRenderer = null;
}

function ensureOverlayLoop() {
  if (overlayLoopHandle !== null) return;
  overlayLoopHandle = requestAnimationFrame(renderAllOverlays);
}

function renderAllOverlays(time: number) {
  overlayLoopHandle = null;
  if (overlays.size === 0) {
    releaseSharedRenderer();
    return;
  }

  const dragDegradeActive = watercolorInteractionDegraded && !readDragDegradeDisabledFlag();
  const frameIntervalMs = dragDegradeActive
    ? Math.max(getFrameIntervalMs(overlays.size), DRAG_DEGRADED_MIN_FRAME_INTERVAL_MS)
    : getFrameIntervalMs(overlays.size);
  const timeSinceLastFrame = time - lastFrameTime;
  const isTimeToRender = timeSinceLastFrame >= frameIntervalMs;

  const renderableOverlays: OverlayRegistration[] = [];
  overlays.forEach((overlay) => {
    if (!overlay.getActive()) {
      overlay.clear();
      return;
    }
    if (!isOverlayRenderable(overlay)) {
      overlay.clear();
      return;
    }
    renderableOverlays.push(overlay);
  });

  const overlaysToRender = dragDegradeActive && renderableOverlays.length > MAX_OVERLAYS_WHILE_DRAG_DEGRADED
    ? renderableOverlays.slice(0, MAX_OVERLAYS_WHILE_DRAG_DEGRADED)
    : renderableOverlays;

  if (isTimeToRender) {
    lastFrameTime = time;

    const { canvas: sharedCanvas, renderer } = getSharedRenderer();
    const timeSeconds = time * 0.001;
    const dpr = window.devicePixelRatio || 1;
    let lastResizeWidth = -1;
    let lastResizeHeight = -1;

    overlaysToRender.forEach((overlay) => {
      const cssWidth = overlay.canvas.clientWidth;
      const cssHeight = overlay.canvas.clientHeight;
      if (cssWidth <= 1 || cssHeight <= 1) return;
      const targetWidth = Math.floor(cssWidth * dpr);
      const targetHeight = Math.floor(cssHeight * dpr);
      if (overlay.canvas.width !== targetWidth || overlay.canvas.height !== targetHeight) {
        overlay.canvas.width = targetWidth;
        overlay.canvas.height = targetHeight;
      }
      if (lastResizeWidth !== targetWidth || lastResizeHeight !== targetHeight) {
        renderer.resize(cssWidth, cssHeight, dpr);
        lastResizeWidth = targetWidth;
        lastResizeHeight = targetHeight;
      }
      const grain = overlay.getGrain();
      const effectiveGrain = dragDegradeActive && grain.enabled
        ? {
          ...grain,
          intensity: grain.intensity * DRAG_GRAIN_INTENSITY_FACTOR,
          frequency: grain.frequency * DRAG_GRAIN_FREQUENCY_FACTOR,
        }
        : grain;
      const effectiveGlow = dragDegradeActive
        ? overlay.getGlowStrength() * DRAG_GLOW_FACTOR
        : overlay.getGlowStrength();
      renderer.render(timeSeconds, overlay.getBlooms(), effectiveGrain, effectiveGlow);
      const ctx = overlay.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(sharedCanvas, 0, 0, targetWidth, targetHeight);
    });

    if (dragDegradeActive && renderableOverlays.length > overlaysToRender.length) {
      for (let i = overlaysToRender.length; i < renderableOverlays.length; i += 1) {
        renderableOverlays[i].clear();
      }
    }
  }

  // Only reschedule if we have active overlays AND haven't exceeded idle timeout
  if (overlays.size > 0 && timeSinceLastFrame < frameIntervalMs * 2) {
    overlayLoopHandle = requestAnimationFrame(renderAllOverlays);
  } else if (overlays.size > 0) {
    // If we've been idle for 2+ frames, try again next frame but don't lock in the loop
    overlayLoopHandle = requestAnimationFrame(renderAllOverlays);
  }
}

export const WatercolorOverlay = memo(forwardRef<WatercolorOverlayHandle, WatercolorOverlayProps>(
function WatercolorOverlay({
  config,
  className,
  style,
}, ref) {
  const watercolorEnabled = useWatercolorEnabled();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blooms = useMemo(() => buildBlooms(config), [config]);
  const bloomsRef = useRef<Bloom[]>(blooms);
  const grainRef = useRef(config.grain);
  const activeRef = useRef(true);
  const glowStrengthRef = useRef(0.6);

  useImperativeHandle(ref, () => ({
    getBlooms: () => bloomsRef.current,
  }), []);

  useEffect(() => {
    bloomsRef.current = blooms;
    grainRef.current = config.grain;
    const glowStrength = config.luminous === false ? 0 : (config.luminousStrength ?? 0.6);
    glowStrengthRef.current = Math.max(0, Math.min(1.5, glowStrength));
  }, [blooms, config.grain, config.luminous, config.luminousStrength]);

  useEffect(() => {
    activeRef.current = watercolorEnabled;
  }, [watercolorEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[WatercolorOverlay] No canvas ref');
      return;
    }
    const ctx = canvas.getContext('2d');
    const registration: OverlayRegistration = {
      canvas,
      ctx,
      getBlooms: () => bloomsRef.current,
      getGrain: () => grainRef.current,
      getGlowStrength: () => glowStrengthRef.current,
      getActive: () => activeRef.current,
      clear: () => {
        if (!ctx) return;
        if (canvas.width > 0 && canvas.height > 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      },
    };

    overlays.add(registration);
    ensureOverlayLoop();

    return () => {
      overlays.delete(registration);
      // If no more overlays, cancel the loop and clean up
      if (overlays.size === 0 && overlayLoopHandle !== null) {
        cancelAnimationFrame(overlayLoopHandle);
        overlayLoopHandle = null;
        releaseSharedRenderer();
      }
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
        opacity: watercolorEnabled ? 1 : 0,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}));
