import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  className?: string;
};

const fragmentShader = `
precision highp float;

varying vec2 vUv;
varying float vElevation;
uniform float uHue;

float hue2rgb(float f1, float f2, float hue) {
  if (hue < 0.0) hue += 1.0;
  else if (hue > 1.0) hue -= 1.0;
  float res;
  if ((6.0 * hue) < 1.0) res = f1 + (f2 - f1) * 6.0 * hue;
  else if ((2.0 * hue) < 1.0) res = f2;
  else if ((3.0 * hue) < 2.0) res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
  else res = f1;
  return res;
}

vec3 hsl2rgb(vec3 hsl) {
  vec3 rgb;
  if (hsl.y == 0.0) {
    rgb = vec3(hsl.z);
  } else {
    float f2;
    if (hsl.z < 0.5) f2 = hsl.z * (1.0 + hsl.y);
    else f2 = hsl.z + hsl.y - hsl.y * hsl.z;
    float f1 = 2.0 * hsl.z - f2;
    rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
    rgb.g = hue2rgb(f1, f2, hsl.x);
    rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
  }
  return rgb;
}

vec3 hsl2rgb(float h, float s, float l) {
  return hsl2rgb(vec3(h, s, l));
}

void main () {
  float hue = uHue + vElevation * .05 + sin(vUv.y)*.5;
  hue += smoothstep(.6, 1.0, vElevation) * .2;
  float highlight = sin ( smoothstep(.6, .91, vElevation) * 3.14 );
  hue += highlight * .1;
  float saturation = vElevation * 1.1;
  float darkborders = sin(vUv.x * 3.14) * sin(vUv.y * 3.14);
  float brightness = pow( darkborders * .3 + vElevation, 3.5);
  brightness *= .5 + smoothstep(.6, 1.0, vElevation) * .1;
  vec3 col = hsl2rgb(hue, saturation, brightness);
  gl_FragColor = vec4(col, 1.0);
}
`;

const vertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;
uniform float time;
uniform vec2 mousePosition;
varying vec2 vUv;
varying float vElevation;

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
  vec3 a = floor(p);
  vec3 d = p - a;
  d = d * d * (3.0 - 2.0 * d);
  vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
  vec4 k1 = perm(b.xyxy);
  vec4 k2 = perm(k1.xyxy + b.zzww);
  vec4 c = k2 + a.zzzz;
  vec4 k3 = perm(c);
  vec4 k4 = perm(c + 1.0);
  vec4 o1 = fract(k3 * (1.0 / 41.0));
  vec4 o2 = fract(k4 * (1.0 / 41.0));
  vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
  vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);
  return o4.y * d.y + o4.x * (1.0 - d.y);
}

float fbm(vec2 pos, float t){
  float r;
  r = noise( vec3( pos, t ) * 1.0 ) * 1.0;
  r += noise( vec3( pos, t ) * 2.0 ) * 0.5;
  r += noise( vec3( pos, t ) * 4.0 ) * 0.25;
  r += noise( vec3( pos, t ) * 8.0 ) * 0.125;
  r += noise( vec3( pos, t ) * 16.0 ) * 0.0625;
  return r / 1.9375;
}

void main() {
  vUv = uv;
  float t = time*.5;
  float t2 = time*.1 + cos(time * .2) * .05;
  vec2 pos = vUv * (2.0 + vUv.y);
  vec2 displacement = vec2(t2, t) + (2.0 + mousePosition * .5);
  float p = fbm( displacement * 2.0 + pos * 2.0, t * 1.1);
  vec2 pos2 = pos + vec2(p);
  float q = fbm( displacement * 3.0 + pos2 * 2.0, t * 1.23); 
  vec2 pos3 = pos + vec2(q);
  float r = fbm( displacement * 4.0 + pos3 * 2.0, t * 1.23); 
  vec2 pos4 = pos + vec2(r);
  float s = fbm( displacement * 5.0 + pos4 * 2.0, t * 1.32);
  float d = length( vUv - (.5 + mousePosition));
  float ratioElevation = pow( (1.0 - d), 5.0);
  vElevation = s + .1 + ratioElevation * .2;
  vElevation *= 1.0 - smoothstep(0.0, 1.0, length(uv - .5));
  vec3 finalPos = position;
  finalPos.z = -30.0 + pow( s + ratioElevation, .5) * 40.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4 ( finalPos, 1.0);
}
`;

export const ChaosSplitAtmosphere = memo(function ChaosSplitAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 20000);
    camera.position.z = 250;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const material1 = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0 },
        uHue: { value: 0.95 },
        mousePosition: { value: new THREE.Vector2(0, 0) },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });

    const material2 = material1.clone();
    material2.uniforms.uHue.value = 0.6;

    const shapeGeometry = new THREE.PlaneGeometry(200, 200, 256, 256);

    const shape1 = new THREE.Mesh(shapeGeometry, material1);
    shape1.position.y = 50;
    shape1.rotation.x = Math.PI / 3;
    shape1.rotation.z = Math.PI;

    const shape2 = new THREE.Mesh(shapeGeometry, material2);
    shape2.position.y = -50;
    shape2.rotation.x = -Math.PI / 3;

    scene.add(shape1);
    scene.add(shape2);

    let timer = 0;
    let rafId = 0;
    let disposed = false;

    const resize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      if (disposed) return;
      timer += 0.01;

      material1.uniforms.time.value = timer;
      material2.uniforms.time.value = timer;

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    animate();

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      if (rafId) window.cancelAnimationFrame(rafId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      shapeGeometry.dispose();
      material1.dispose();
      material2.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={rootRef} className={`w-full h-full ${className}`} />;
});
