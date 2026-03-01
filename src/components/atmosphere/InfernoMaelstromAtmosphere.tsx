import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  className?: string;
};

const CLOUDS_TEXTURE_URL = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/982762/Alien_Muscle_001_COLOR.jpg';

const vertexShader = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_clouds;

const float multiplier = 1.5;
const float zoomSpeed = 4.0;
const int layers = 10;

const int octaves = 1;
const float seed = 43758.5453123;

float random(float val) {
  return fract(sin(val) * seed);
}

vec2 random2(vec2 st, float s) {
  st = vec2(
    dot(st, vec2(127.1, 311.7)),
    dot(st, vec2(269.5, 183.3))
  );
  return -1.0 + 2.0 * fract(sin(st) * s);
}

mat2 rotate2d(float angleValue) {
  return mat2(
    cos(angleValue), sin(angleValue),
    -sin(angleValue), cos(angleValue)
  );
}

float noise(vec2 st, float s) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      dot(random2(i + vec2(0.0, 0.0), s), f - vec2(0.0, 0.0)),
      dot(random2(i + vec2(1.0, 0.0), s), f - vec2(1.0, 0.0)),
      u.x
    ),
    mix(
      dot(random2(i + vec2(0.0, 1.0), s), f - vec2(0.0, 1.0)),
      dot(random2(i + vec2(1.0, 1.0), s), f - vec2(1.0, 1.0)),
      u.x
    ),
    u.y
  );
}

float fbm(vec2 st, float s) {
  float value = 0.0;
  float amp = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(1.5), sin(1.5), -sin(1.5), cos(1.5));
  for (int i = 0; i < octaves; i += 1) {
    value += amp * abs(noise(st, s));
    st = rot * st * 2.0 + shift;
    amp *= 0.5;
  }
  return value;
}

vec3 render(vec2 uv, float m, inout vec2 id) {
  return texture2D(u_clouds, uv).rgb;
}

vec3 infernoRamp(float luminance) {
  vec3 embers = vec3(0.09, 0.01, 0.01);
  vec3 lava = vec3(0.98, 0.22, 0.05);
  vec3 flame = vec3(1.0, 0.68, 0.08);
  vec3 whiteHot = vec3(1.0, 0.97, 0.76);
  vec3 low = mix(embers, lava, smoothstep(0.0, 0.45, luminance));
  vec3 high = mix(flame, whiteHot, smoothstep(0.45, 1.0, luminance));
  return mix(low, high, smoothstep(0.3, 1.0, luminance));
}

vec3 renderLayer(int layer, vec2 uv, inout float opacity, inout vec2 id, in vec3 colour) {
  float scale = mod((u_time + zoomSpeed / float(layers) * float(layer)) / zoomSpeed, -1.0);
  float vignette = smoothstep(0.1, 0.3, length(uv * scale * 1.5));
  uv *= 1.0 + scale;
  uv *= 1.0 + random(float(layer));
  uv *= scale;
  uv = rotate2d((u_time * 0.1 + (scale * 2.0))) * uv;

  vec3 pass = render(uv * multiplier + colour.z, multiplier, id);

  opacity = clamp(1.0 + scale * 1.1, 0.0, 1.0) - smoothstep(0.5, 0.2, pass.x);
  opacity -= smoothstep(0.0, 0.8, clamp(1.0 - vignette * 2.0 * (1.0 + scale * -1.0) * pass.x, 0.0, 1.0));
  float baseOpacity = opacity;

  float endOpacity = smoothstep(0.0, 0.05, scale * -1.0);
  opacity += endOpacity;
  return clamp(pass * baseOpacity * endOpacity, 0.0, 1.0) * 2.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy - 0.5 * u_resolution.xy;
  if (u_resolution.y < u_resolution.x) {
    uv /= u_resolution.y;
  } else {
    uv /= u_resolution.x;
  }

  vec3 colour = vec3(0.0);
  vec3 layerColour = vec3(0.0);
  float opacity = 1.0;

  for (int i = 1; i <= layers; i += 1) {
    vec2 id;
    vec3 layer = renderLayer(i, uv, opacity, id, colour * clamp(1.0 - length(uv) * 0.8, 0.0, 1.0));
    layerColour = layer * 2.0;
    vec3 cellColour = colour * (1.0 + length(id)) * 0.5 + 0.2;
    colour = mix(colour, cellColour, layerColour);
  }

  float falloff = 1.0 - length(uv) * 0.5 + 0.5;
  vec3 grayscaleResult = colour * 1.5 * falloff;
  float luminance = clamp(dot(grayscaleResult, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
  vec3 inferno = infernoRamp(luminance);

  float flicker = 0.85 + 0.15 * sin(u_time * 5.5 + uv.y * 18.0 + uv.x * 9.0);
  inferno *= flicker;

  gl_FragColor = vec4(inferno, 1.0);
}
`;

function createFallbackCloudTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const n1 = Math.random();
      const n2 = Math.sin((x * 0.09) + (y * 0.045)) * 0.5 + 0.5;
      const n3 = Math.cos((x * 0.03) - (y * 0.07)) * 0.5 + 0.5;
      const value = Math.floor((n1 * 0.4 + n2 * 0.35 + n3 * 0.25) * 255);
      data[index] = value;
      data[index + 1] = Math.min(255, value + 12);
      data[index + 2] = Math.max(0, value - 24);
      data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function configureCloudTexture(texture: THREE.Texture) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

export const InfernoMaelstromAtmosphere = memo(function InfernoMaelstromAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const fallbackCloudTexture = createFallbackCloudTexture();
    const uniforms = {
      u_time: { value: 1.0 },
      u_resolution: { value: new THREE.Vector2() },
      u_mouse: { value: new THREE.Vector2() },
      u_clouds: { value: fallbackCloudTexture as THREE.Texture },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    let rafId = 0;
    let disposed = false;

    loader.load(
      CLOUDS_TEXTURE_URL,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        configureCloudTexture(texture);
        const previousTexture = uniforms.u_clouds.value;
        uniforms.u_clouds.value = texture;
        if (previousTexture !== texture) previousTexture.dispose();
      },
      undefined,
      () => {
        // Keep fallback texture when remote load fails.
      },
    );

    const drawingBufferSize = new THREE.Vector2();
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      renderer.getDrawingBufferSize(drawingBufferSize);
      uniforms.u_resolution.value.set(drawingBufferSize.x, drawingBufferSize.y);
    };

    const onPointerMove = (event: PointerEvent) => {
      const ratio = window.innerHeight / Math.max(window.innerWidth, 1);
      uniforms.u_mouse.value.x = (event.pageX - window.innerWidth / 2) / Math.max(window.innerWidth, 1) / ratio;
      uniforms.u_mouse.value.y = (event.pageY - window.innerHeight / 2) / Math.max(window.innerHeight, 1) * -1;
    };

    const render = (timestamp: number) => {
      if (disposed) return;
      uniforms.u_time.value = -10000 + timestamp * 0.0005;
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    rafId = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      if (rafId) window.cancelAnimationFrame(rafId);
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      uniforms.u_clouds.value.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        background:
          'radial-gradient(circle at 50% 45%, #5e1608 0%, #2c0905 38%, #150503 66%, #090201 100%)',
      }}
    />
  );
});
