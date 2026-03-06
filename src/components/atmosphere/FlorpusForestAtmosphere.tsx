import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  className?: string;
};

const backgroundVertexShader = `
attribute vec3 position;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vPosition = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const backgroundFragmentShader = `
#ifdef GL_ES
precision mediump float;
#endif

#define RGB(r, g, b) vec3(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0)

uniform vec2 resolution;
uniform float globalTime;
varying vec3 vPosition;

// Noise functions
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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; ++i) {
    v += a * noise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// SDF Helpers
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

vec2 rotate(vec2 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c) * p;
}

void main() {
  // Use vPosition for spherical mapping for stars
  vec3 pos = normalize(vPosition);
  float phi = atan(pos.z, pos.x);
  float theta = acos(pos.y);
  vec2 uv = vec2(phi / (2.0 * 3.14159) + 0.5, theta / 3.14159);
  
  // Screen-space-like coord for the rift to keep it framed nicely
  vec2 screenUv = gl_FragCoord.xy / resolution.xy;
  vec2 p = (screenUv - 0.5) * 2.0;
  float aspect = resolution.x / resolution.y;
  p.x *= aspect;

  // Background: Deep dark space-purple
  float bgNoise = fbm(p * 0.4 + globalTime * 0.02);
  vec3 bgColor = mix(RGB(15, 0, 35), RGB(2, 0, 10), length(p) * 0.4 + bgNoise);
  vec3 finalColor = bgColor;

  // --- STARS ---
  float s = hash(floor(uv * 800.0));
  if (s > 0.991) {
    float twinkle = sin(globalTime * 2.0 + s * 100.0) * 0.5 + 0.5;
    float starBrightness = step(0.996, hash(uv * 900.0));
    finalColor += vec3(1.0, 0.95, 1.0) * twinkle * starBrightness * 1.2;
  }

  // --- PLANETARY BODIES ---

  // 1. Crystalline Cluster (Upper Left)
  vec2 crysPos = p - vec2(-0.65 * aspect, 0.55);
  float crysD = 1e10;
  // Combine many hexagons for a "cluster" feel
  crysD = min(crysD, sdHexagon(rotate(crysPos, 0.2), 0.08));
  crysD = min(crysD, sdHexagon(rotate(crysPos - vec2(0.06, 0.05), -0.4), 0.06));
  crysD = min(crysD, sdHexagon(rotate(crysPos - vec2(-0.07, 0.02), 0.8), 0.05));
  crysD = min(crysD, sdHexagon(rotate(crysPos - vec2(0.02, -0.07), 1.2), 0.07));
  crysD = min(crysD, sdHexagon(rotate(crysPos - vec2(0.08, -0.02), 0.5), 0.04));
  crysD = min(crysD, sdHexagon(rotate(crysPos - vec2(-0.04, 0.08), -0.9), 0.045));
  
  if (crysD < 0.15) {
    float shape = smoothstep(0.0, -0.005, crysD);
    vec3 col = mix(RGB(60, 10, 80), RGB(160, 30, 180), fbm(crysPos * 12.0));
    // High-frequency "facet" noise
    col *= (0.8 + noise(crysPos * 40.0) * 0.3);
    float glow = smoothstep(0.15, -0.05, crysD);
    finalColor = mix(finalColor, col, shape) + RGB(180, 60, 255) * pow(glow, 4.5) * 0.7;
  }

  // 2. Ringed Cube (Bottom Left)
  float rotTime = globalTime * 0.4;
  vec2 cubePos = p - vec2(-0.45 * aspect, -0.45);
  vec2 rotCube = rotate(cubePos, rotTime);
  float boxD = sdBox(rotCube, vec2(0.065));
  // The ring is a hollowed square frame
  float ringOuter = sdBox(rotate(cubePos, -rotTime * 0.25), vec2(0.13, 0.13));
  float ringInner = sdBox(rotate(cubePos, -rotTime * 0.25), vec2(0.11, 0.11));
  float ringD = max(ringOuter, -ringInner);
  
  float bodyD = min(boxD, ringD);
  if (bodyD < 0.12) {
    float boxShape = smoothstep(0.0, -0.005, boxD);
    float ringShape = smoothstep(0.0, -0.005, ringD);
    vec3 cubeCol = RGB(100, 20, 130) * (0.7 + fbm(rotCube * 15.0) * 0.5);
    vec3 ringCol = RGB(255, 40, 160);
    
    finalColor = mix(finalColor, cubeCol, boxShape);
    finalColor = mix(finalColor, ringCol, ringShape);
    float glow = smoothstep(0.12, -0.05, bodyD);
    finalColor += RGB(255, 80, 180) * pow(glow, 3.5) * 0.5;
  }

  // 3. Spiral Planetoid with Debris (Right)
  vec2 planetPos = p - vec2(0.65 * aspect, 0.15);
  float dPlanet = length(planetPos);
  float rPlanet = 0.24;
  
  // Debris orbiting (more irregular)
  float debrisD = 1e10;
  for(int i=0; i<8; i++) {
    float fi = float(i);
    float ang = globalTime * 0.6 + fi * 0.785;
    float dist = rPlanet + 0.1 + noise(vec2(fi * 1.3, globalTime * 0.08)) * 0.07;
    vec2 dPos = planetPos - vec2(cos(ang), sin(ang)) * dist;
    // Rotate debris pieces randomly
    float dShape = sdBox(rotate(dPos, ang * 3.0 + fi), vec2(0.01 + hash(vec2(fi)) * 0.025));
    debrisD = min(debrisD, dShape);
  }

  if (dPlanet < rPlanet * 1.4 || debrisD < 0.05) {
    float shape = smoothstep(rPlanet, rPlanet - 0.01, dPlanet);
    
    // Spiral surface pattern with central "eye"
    float angle = atan(planetPos.y, planetPos.x);
    float swirl = fbm(vec2(angle * 3.0 + dPlanet * 10.0 - globalTime * 1.5, dPlanet * 4.0));
    // Dark core hole
    float eye = smoothstep(0.04, 0.0, dPlanet);
    vec3 col = mix(RGB(200, 20, 100), RGB(50, 5, 25), swirl);
    col = mix(col, vec3(0.0), eye);
    
    float glow = smoothstep(rPlanet * 1.4, rPlanet - 0.05, dPlanet);
    finalColor = mix(finalColor, col, shape) + RGB(255, 40, 100) * pow(glow, 3.0) * 0.8;
    
    // Mix in debris (darker, more jagged)
    float debrisShape = smoothstep(0.0, -0.005, debrisD);
    finalColor = mix(finalColor, RGB(40, 5, 20), debrisShape);
  }

  // --- THE TEAR (Diagonal Rift) ---
  // Diagonal orientation (roughly top-left to bottom-right)
  float angle_rot = -0.65; 
  mat2 rMat = mat2(cos(angle_rot), -sin(angle_rot), sin(angle_rot), cos(angle_rot));
  // Keep it roughly where it was but slightly offset to not overlap planet too much
  vec2 rp = rMat * (p - vec2(0.55 * aspect, 0.2)); 
  
  // Chaotic jaggedness using multiple noise scales
  float jagged = fbm(vec2(rp.x * 3.0, globalTime * 0.2)) * 0.15;
  jagged += noise(vec2(rp.x * 12.0, globalTime * 0.6)) * 0.03;
  jagged += noise(vec2(rp.x * 40.0, globalTime * 2.5)) * 0.01;
  
  // Tear width tapers aggressively at ends to limit length
  float limitLeft = 0.35;
  float limitRight = 0.75; 
  float lengthMask = rp.x < 0.0 ? 
    smoothstep(limitLeft, limitLeft - 0.1, abs(rp.x)) : 
    smoothstep(limitRight, limitRight - 0.35, rp.x);
  
  // Dynamic width: thicker in center (rp.x=0), tapering to very thin at ends
  float widthTaper = 1.0 - pow(smoothstep(0.0, limitRight, abs(rp.x)), 0.7);
  float tearWidth = 0.06 * widthTaper * lengthMask;
  
  float distToTear = abs(rp.y + jagged);
  float tearShape = smoothstep(tearWidth, tearWidth - 0.005, distToTear); // Sharper edge for "skinny" look
  
  // Chaotic Magenta Effusion
  // Multi-scale noise for "chaotic" edges
  float effusionNoise = fbm(rp * 4.0 + globalTime * 0.15);
  // Glow also follows the skinny tapering
  float glowDist = (0.22 + effusionNoise * 0.25) * lengthMask * widthTaper;
  float glow = smoothstep(glowDist, -0.05, distToTear);
  
  float pulse = sin(globalTime * 3.0 + rp.x * 10.0) * 0.5 + 0.5;
  vec3 fuchsiaGlow = RGB(255, 0, 160) * pow(glow, 2.5) * (3.5 + pulse * 1.5);
  
  // Nebula clouds along the rift with more chaos
  float cloudNoise = fbm(rp * 2.5 - globalTime * 0.12 + effusionNoise);
  float clouds = smoothstep(0.2, 0.8, cloudNoise) * glow;
  vec3 cloudColor = mix(RGB(120, 0, 255), RGB(255, 10, 180), cloudNoise);
  
  // Combine Rift (Deep black core)
  // Ensure the tear core is absolutely black
  vec3 riftColor = mix(fuchsiaGlow * 0.4 + cloudColor * clouds * 0.7, vec3(0.0), tearShape);
  
  // To make the center truly black, we must mask the existing finalColor
  finalColor *= (1.0 - tearShape);
  
  // Add masked fuchsia glow and rift colors
  finalColor += riftColor + (fuchsiaGlow * 0.3 * (1.0 - tearShape));

  gl_FragColor = vec4(finalColor, 1.0);
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
  vec3 glowColor = RGB(255, 69, 233);
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

export const FlorpusForestAtmosphere = memo(function FlorpusForestAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    // Very dark background purple for the fog
    scene.fog = new THREE.Fog(0x0c0016, 40, 180);

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setSize(width, height, false);
      backgroundUniforms.resolution.value.set(
        width * dpr,
        height * dpr,
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

  return <div ref={rootRef} className={`w-full h-full ${className}`} />;
});
