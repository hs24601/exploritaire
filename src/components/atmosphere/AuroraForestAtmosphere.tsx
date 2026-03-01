import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  className?: string;
};

const backgroundVertexShader = `
attribute vec3 position;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const backgroundFragmentShader = `
#ifdef GL_ES
precision mediump float;
#endif

#define OCTAVES 2
#define RGB(r, g, b) vec3(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0)

uniform vec2 resolution;
uniform float globalTime;

float random(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 rand2(vec2 p) {
  p = vec2(dot(p, vec2(12.9898, 78.233)), dot(p, vec2(26.65125, 83.054543)));
  return fract(sin(p) * 43758.5453);
}

float rand(vec2 p) {
  return fract(sin(dot(p.xy, vec2(54.90898, 18.233))) * 4337.5453);
}

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float stars(in vec2 x, float numCells, float size, float br) {
  vec2 n = x * numCells;
  vec2 f = floor(n);
  float d = 1.0e10;

  for (int i = -1; i <= 1; ++i) {
    for (int j = -1; j <= 1; ++j) {
      vec2 g = f + vec2(float(i), float(j));
      g = n - g - rand2(mod(g, numCells)) + rand(g);
      g *= 1.0 / (numCells * size);
      d = min(d, dot(g, g));
    }
  }

  return br * smoothstep(0.95, 1.0, (1.0 - sqrt(d)));
}

float fractalNoise(in vec2 coord, in float persistence, in float lacunarity) {
  float n = 0.0;
  float frequency = 3.0;
  float amplitude = 2.0;
  for (int o = 0; o < OCTAVES; ++o) {
    n += amplitude * snoise(coord * frequency);
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return n;
}

void main() {
  vec2 coord = gl_FragCoord.xy / resolution.xy;
  vec2 starCoord = gl_FragCoord.xy / resolution.yy - vec2(0.5, 0.0);
  vec3 color1 = RGB(10, 70, 50) * 1.5;
  vec3 color2 = RGB(50, 0, 40) * 1.1;
  float dist = distance(coord, vec2(0.5, 0.3)) * 1.5;
  float time = -globalTime / 100.0;

  mat2 rotation = mat2(cos(time), sin(time), -sin(time), cos(time));
  vec3 starField = stars(starCoord * rotation, 16.0, 0.03, 0.8) * vec3(0.9, 0.9, 0.95);
  starField += stars(starCoord * rotation, 40.0, 0.025, 1.0) * vec3(0.9, 0.9, 0.95) * max(0.0, fractalNoise(starCoord * rotation, 0.5, 0.2));

  vec3 aurora = RGB(0, 255, 130) * max(
    snoise(vec2((coord.x + sin(time)) * 15.0, coord.x * 40.0)) * max((sin(10.0 * (coord.x + 2.0 * time)) * 0.1 + 1.26) - 2.0 * coord.y, 0.0),
    0.0
  );
  vec3 aurora2 = RGB(0, 235, 170) * max(
    snoise(vec2((0.09 * coord.x + sin(time * 0.5)) * 15.0, coord.x * 1.0)) * max((sin(5.0 * (coord.x + 1.5 * time)) * 0.1 + 1.28) - 2.0 * coord.y, 0.0),
    0.0
  );

  vec3 result = starField + aurora * aurora2.g * 3.5 + aurora2;
  gl_FragColor = vec4(mix(color1, color2, dist), 1.0);
  gl_FragColor.rgb += result;
}
`;

const mountainVertexShader = `
varying vec2 vUv;
varying float fogDepth;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  fogDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const mountainFragmentShader = `
#ifdef GL_ES
precision mediump float;
#endif

varying vec2 vUv;
varying float fogDepth;

#include <fog_pars_fragment>

float random(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float offset = random(vec2(gl_FragCoord.w));
  vec2 p = vUv;
  p *= 0.3;
  p.y = p.y * 30.0 - 4.0;
  p.x = p.x * (80.0 * offset) + 14.8 * offset;

  float h = max(
    0.0,
    max(
      max(abs(fract(p.x) - 0.5) - 0.25, 3.0 * (abs(fract(0.7 * p.x + 0.4) - 0.5) - 0.4)),
      max(1.2 * (abs(fract(0.8 * p.x + 0.6) - 0.5) - 0.2), 0.3 * abs(fract(0.5 * p.x + 0.2) - 0.5))
    )
  );
  float fill = 1.0 - smoothstep(h, h + 0.001, p.y);

  vec4 outColor = vec4(vec3(0.0), fill);

  #ifdef USE_FOG
  float fogFactor = smoothstep(fogNear, fogFar, fogDepth);
  outColor.rgb = mix(outColor.rgb, fogColor, fogFactor);
  #endif

  gl_FragColor = outColor;
}
`;

const treeVertexShader = `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const treeFragmentShader = `
#ifdef GL_ES
precision mediump float;
#endif

#define RGB(r, g, b) vec3(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0)

uniform float globalTime;
varying vec2 vUv;

float treeFill(in float size, in vec2 offset) {
  vec2 p = vUv;
  vec2 q = p - vec2(0.5, 0.5);
  vec2 q1 = 100.0 / size * q - offset;
  float r = mod(-0.8 * q1.y, 1.0 - 0.06 * q1.y) * -0.05 * q1.y - 0.1 * q1.y;
  float wav = abs(q1.x + 0.5 * sin(0.9 * globalTime + p.x * 25.0) * (1.0 + q1.y / 13.0));
  float fill = (1.0 - smoothstep(r, r + 0.001, wav)) * smoothstep(0.0, 0.01, q1.y + 13.0);
  return fill;
}

vec4 tree(in float size, in vec2 offset) {
  float glowDist = 0.12;
  vec3 glowColor = RGB(11, 115, 95);
  float body = treeFill(size, offset);
  float glow = treeFill(size, vec2(offset.x + glowDist, offset.y));
  return max(vec4(glowColor * (glow - body), glow), vec4(0.0));
}

void main() {
  vec2 p = vUv;
  p *= 0.3;
  p.y = p.y * 30.0 - 4.0;
  p.x = p.x * 30.0;

  vec4 col = tree(1.0, vec2(-30.0, 7.0));
  col += tree(1.2, vec2(-15.0, 8.0));
  col += tree(1.1, vec2(-12.0, 4.0));
  col += tree(1.0, vec2(-9.0, 6.0));
  col += tree(1.1, vec2(-10.0, 3.0));
  col += tree(1.0, vec2(-3.0, 4.0));
  col += tree(1.1, vec2(-1.5, 5.0));
  col += tree(1.0, vec2(5.0, 3.0));
  col += tree(1.3, vec2(12.0, 8.0));
  col += tree(0.9, vec2(15.0, 7.0));
  col += tree(1.0, vec2(18.0, 7.0));
  col += tree(1.1, vec2(26.0, 7.0));

  gl_FragColor = vec4(max(col.rgb * p.y, vec3(0.0)), col.a);
}
`;

export const AuroraForestAtmosphere = memo(function AuroraForestAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xff00ff, 40, 180);

    const camera = new THREE.PerspectiveCamera(70, 1, 1, 5000);
    camera.position.set(0, -8, 40);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const backgroundUniforms = {
      resolution: { value: new THREE.Vector2(1, 1) },
      globalTime: { value: performance.now() / 1000 },
    };
    const backgroundMaterial = new THREE.RawShaderMaterial({
      vertexShader: backgroundVertexShader,
      fragmentShader: backgroundFragmentShader,
      uniforms: backgroundUniforms,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const backgroundGeometry = new THREE.SphereGeometry(4000, 32, 15);
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    scene.add(backgroundMesh);

    const treeUniforms = { globalTime: { value: performance.now() / 1000 } };
    const treeMaterial = new THREE.RawShaderMaterial({
      vertexShader: treeVertexShader,
      fragmentShader: treeFragmentShader,
      uniforms: treeUniforms,
      transparent: true,
      depthWrite: false,
    });
    const treeGeometry = new THREE.PlaneGeometry(200, 200, 1, 1);
    const treeMesh = new THREE.Mesh(treeGeometry, treeMaterial);
    treeMesh.position.set(0, -10, 0.1);
    scene.add(treeMesh);

    const mountainMaterial = new THREE.ShaderMaterial({
      vertexShader: mountainVertexShader,
      fragmentShader: mountainFragmentShader,
      uniforms: {
        fogColor: { value: scene.fog.color },
        fogNear: { value: scene.fog.near },
        fogFar: { value: scene.fog.far },
      },
      fog: true,
      transparent: true,
      depthWrite: false,
    });
    const mountainGeometry = new THREE.PlaneGeometry(600, 200, 1, 1);
    const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
    mountain.position.set(0, -8, 0);
    const mountain2 = new THREE.Mesh(mountainGeometry.clone(), mountainMaterial);
    mountain2.position.set(0, -10, -26);
    const mountain3 = new THREE.Mesh(mountainGeometry.clone(), mountainMaterial);
    mountain3.position.set(0, -8, -35);
    scene.add(mountain);
    scene.add(mountain2);
    scene.add(mountain3);

    let rafId = 0;
    let disposed = false;

    const resize = () => {
      if (!mount) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const aspect = width / height;
      const isPortrait = aspect < 1;
      const portraitScale = isPortrait ? 0.68 : 1;
      const sceneYOffset = isPortrait ? -2 : -10;
      const cameraY = isPortrait ? 0 : -8;
      const cameraZ = isPortrait ? 48 : 40;
      const lookAtY = isPortrait ? -12 : sceneYOffset;
      camera.fov = isPortrait ? 78 : 70;
      camera.position.set(0, cameraY, cameraZ);
      camera.lookAt(0, lookAtY, 0);
      treeMesh.position.y = sceneYOffset;
      treeMesh.scale.set(portraitScale, portraitScale, 1);
      mountain.position.y = sceneYOffset + 2;
      mountain2.position.y = sceneYOffset;
      mountain3.position.y = sceneYOffset + 2;
      mountain.scale.set(1, portraitScale, 1);
      mountain2.scale.set(1, portraitScale, 1);
      mountain3.scale.set(1, portraitScale, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      backgroundUniforms.resolution.value.set(
        width * (window.devicePixelRatio || 1),
        height * (window.devicePixelRatio || 1),
      );
    };
    resize();

    const animate = (timestamp: number) => {
      if (disposed) return;
      const seconds = timestamp / 1000;
      backgroundUniforms.globalTime.value = seconds;
      treeUniforms.globalTime.value = seconds;
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);

    window.addEventListener('resize', resize);
    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      if (rafId) window.cancelAnimationFrame(rafId);
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      backgroundGeometry.dispose();
      treeGeometry.dispose();
      mountainGeometry.dispose();
      mountain2.geometry.dispose();
      mountain3.geometry.dispose();
      backgroundMaterial.dispose();
      treeMaterial.dispose();
      mountainMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={rootRef} className={className} />;
});
