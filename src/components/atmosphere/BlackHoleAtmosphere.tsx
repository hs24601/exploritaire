import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

type Props = {
  className?: string;
};

const BLACK_HOLE_RADIUS = 1.3;
const DISK_INNER_RADIUS = BLACK_HOLE_RADIUS + 0.2;
const DISK_OUTER_RADIUS = 8.0;
const DISK_TILT_ANGLE = Math.PI / 3.0;
const STAR_COUNT = 100000;

export const BlackHoleAtmosphere = memo(function BlackHoleAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020104, 0.035);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 4000);
    camera.position.set(-6.5, 5.0, 6.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.7, 0.2);
    composer.addPass(bloomPass);

    const lensingPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        blackHoleScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
        lensingStrength: { value: 0.12 },
        lensingRadius: { value: 0.3 },
        aspectRatio: { value: 1 },
        chromaticAberration: { value: 0.015 },
        scanlineIntensity: { value: 0.15 },
        vignetteDarkness: { value: 0.8 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 blackHoleScreenPos;
        uniform float lensingStrength;
        uniform float lensingRadius;
        uniform float aspectRatio;
        uniform float chromaticAberration;
        uniform float scanlineIntensity;
        uniform float vignetteDarkness;
        varying vec2 vUv;

        void main() {
          vec2 toCenter = vUv - blackHoleScreenPos;
          toCenter.x *= aspectRatio;
          float dist = length(toCenter);
          float distortionAmount = lensingStrength / (dist * dist + 0.003);
          distortionAmount = clamp(distortionAmount, 0.0, 0.7);
          float falloff = smoothstep(lensingRadius, lensingRadius * 0.3, dist);
          distortionAmount *= falloff;
          vec2 offset = normalize(toCenter) * distortionAmount;
          offset.x /= aspectRatio;

          vec2 uvR = vUv - offset * (1.0 + chromaticAberration);
          vec2 uvG = vUv - offset;
          vec2 uvB = vUv - offset * (1.0 - chromaticAberration);
          vec3 color = vec3(
            texture2D(tDiffuse, uvR).r,
            texture2D(tDiffuse, uvG).g,
            texture2D(tDiffuse, uvB).b
          );

          float scanline = sin(vUv.y * 800.0) * 0.5 + 0.5;
          color -= scanline * scanlineIntensity * color;
          float vignette = length(vUv - vec2(0.5));
          color *= (1.0 - vignette * vignetteDarkness);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    composer.addPass(lensingPass);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 2.5;
    controls.maxDistance = 100;
    controls.touches = { ONE: THREE.TOUCH.NONE, TWO: THREE.TOUCH.DOLLY };
    controls.target.set(0, 0, 0);
    controls.update();

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    const starSizes = new Float32Array(STAR_COUNT);
    const starTwinkle = new Float32Array(STAR_COUNT);
    const starFieldRadius = 2000;
    const starPalette = [
      new THREE.Color(0x00ffff),
      new THREE.Color(0xff00ff),
      new THREE.Color(0x8a2be2),
      new THREE.Color(0x00ff7f),
      new THREE.Color(0xccddff),
    ];

    for (let i = 0; i < STAR_COUNT; i += 1) {
      const i3 = i * 3;
      const phi = Math.acos(-1 + (2 * i) / STAR_COUNT);
      const theta = Math.sqrt(STAR_COUNT * Math.PI) * phi;
      const radius = Math.cbrt(Math.random()) * starFieldRadius + 100;
      starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i3 + 2] = radius * Math.cos(phi);

      const starColor = starPalette[Math.floor(Math.random() * starPalette.length)].clone();
      starColor.multiplyScalar(Math.random() * 0.7 + 0.3);
      starColors[i3] = starColor.r;
      starColors[i3 + 1] = starColor.g;
      starColors[i3 + 2] = starColor.b;
      starSizes[i] = THREE.MathUtils.randFloat(0.8, 2.5);
      starTwinkle[i] = Math.random() * Math.PI * 2;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    starGeometry.setAttribute('twinkle', new THREE.BufferAttribute(starTwinkle, 1));

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float size;
        attribute float twinkle;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vColor = color;
          vTwinkle = sin(uTime * 2.5 + twinkle) * 0.5 + 0.5;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          float cross = abs(gl_PointCoord.x - 0.5) + abs(gl_PointCoord.y - 0.5);
          if (cross > 0.5) discard;
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha *= (0.2 + vTwinkle * 0.8);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const eventHorizonGeom = new THREE.SphereGeometry(BLACK_HOLE_RADIUS * 1.05, 128, 64);
    const eventHorizonMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: camera.position.clone() },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uCameraPosition;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDirection = normalize(uCameraPosition - vPosition);
          float fresnel = 1.0 - abs(dot(vNormal, viewDirection));
          fresnel = pow(fresnel, 2.0);
          vec3 glowColor = vec3(0.0, 1.0, 0.8);
          float pulse = sin(uTime * 3.5) * 0.2 + 0.8;
          gl_FragColor = vec4(glowColor * fresnel * pulse, fresnel * 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const eventHorizon = new THREE.Mesh(eventHorizonGeom, eventHorizonMat);
    scene.add(eventHorizon);

    const blackHoleGeom = new THREE.SphereGeometry(BLACK_HOLE_RADIUS, 128, 64);
    const blackHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackHoleMesh = new THREE.Mesh(blackHoleGeom, blackHoleMat);
    blackHoleMesh.renderOrder = 0;
    scene.add(blackHoleMesh);

    const diskGeometry = new THREE.RingGeometry(DISK_INNER_RADIUS, DISK_OUTER_RADIUS, 256, 128);
    const diskMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uColorHot: { value: new THREE.Color(0xffffff) },
        uColorMid1: { value: new THREE.Color(0xff00ff) },
        uColorMid2: { value: new THREE.Color(0x00ffff) },
        uColorOuter: { value: new THREE.Color(0x3939f5) },
        uNoiseScale: { value: 3.5 },
        uFlowSpeed: { value: 0.25 },
        uDensity: { value: 1.5 },
      },
      vertexShader: `
        varying float vRadius;
        varying float vAngle;
        void main() {
          vRadius = length(position.xy);
          vAngle = atan(position.y, position.x);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorHot;
        uniform vec3 uColorMid1;
        uniform vec3 uColorMid2;
        uniform vec3 uColorOuter;
        uniform float uNoiseScale;
        uniform float uFlowSpeed;
        uniform float uDensity;
        varying float vRadius;
        varying float vAngle;

        vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
        vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v){
          const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
        }

        void main() {
          float normalizedRadius = smoothstep(1.5, 8.0, vRadius);
          float timeOffset = uTime * uFlowSpeed * (2.0 / (vRadius * 0.3 + 1.0));
          vec2 noiseUv = vec2(vAngle * 2.0 + timeOffset, vRadius * 0.5);
          float noiseVal1 = snoise(vec3(noiseUv * uNoiseScale, uTime * 0.15));
          float noiseVal2 = snoise(vec3(noiseUv * uNoiseScale * 2.0 + 0.8, uTime * 0.22));
          float noiseVal = (noiseVal1 * 0.6 + noiseVal2 * 0.4);
          noiseVal = (noiseVal + 1.0) * 0.5;

          vec3 color = mix(uColorOuter, uColorMid2, smoothstep(0.0, 0.4, normalizedRadius));
          color = mix(color, uColorMid1, smoothstep(0.3, 0.7, normalizedRadius));
          color = mix(color, uColorHot, smoothstep(0.65, 0.95, normalizedRadius));

          float brightness = pow(1.0 - normalizedRadius, 1.2) * 3.0 + 0.5;
          brightness *= (0.3 + noiseVal * 2.2);
          float alpha = uDensity * (0.2 + noiseVal * 0.9);
          alpha *= smoothstep(0.0, 0.15, normalizedRadius);
          alpha *= (1.0 - smoothstep(0.85, 1.0, normalizedRadius));
          alpha = clamp(alpha, 0.0, 1.0);
          gl_FragColor = vec4(color * brightness, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
    accretionDisk.rotation.x = DISK_TILT_ANGLE;
    scene.add(accretionDisk);

    const gridHelper = new THREE.GridHelper(100, 50, 0x00ffff, 0x00ffff);
    const gridMaterial = gridHelper.material as THREE.Material & { opacity?: number; blending?: THREE.Blending };
    gridMaterial.opacity = 0.1;
    gridMaterial.transparent = true;
    gridMaterial.blending = THREE.AdditiveBlending;
    gridHelper.position.y = -10;
    scene.add(gridHelper);

    const blackHoleScreenPos = new THREE.Vector3();
    const clock = new THREE.Clock();
    let rafId = 0;
    let disposed = false;

    const gyroTarget = { yaw: 0, pitch: 0 };
    const gyroCurrent = { yaw: 0, pitch: 0 };
    let orbitRadius = camera.position.distanceTo(controls.target);

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      const mappedYaw = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(event.gamma, -60, 60) * 0.6);
      const mappedPitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(event.beta - 45, -45, 45) * 0.5);
      gyroTarget.yaw = mappedYaw;
      gyroTarget.pitch = mappedPitch;
    };

    const requestGyroPermission = () => {
      const maybeDeviceOrientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof maybeDeviceOrientation.requestPermission === 'function') {
        maybeDeviceOrientation.requestPermission()
          .then((state) => {
            if (state === 'granted') {
              window.addEventListener('deviceorientation', handleDeviceOrientation);
            }
          })
          .catch(() => {});
      } else {
        window.addEventListener('deviceorientation', handleDeviceOrientation);
      }
    };

    const handleFirstInteraction = () => {
      requestGyroPermission();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true });

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      bloomPass.resolution.set(width, height);
      lensingPass.uniforms.aspectRatio.value = width / height;
      starMaterial.uniforms.uPixelRatio.value = ratio;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const delta = clock.getDelta();

      gyroCurrent.yaw = THREE.MathUtils.lerp(gyroCurrent.yaw, gyroTarget.yaw, 0.04);
      gyroCurrent.pitch = THREE.MathUtils.lerp(gyroCurrent.pitch, gyroTarget.pitch, 0.04);
      orbitRadius = camera.position.distanceTo(controls.target);

      const desired = new THREE.Vector3(
        Math.sin(gyroCurrent.yaw) * Math.cos(gyroCurrent.pitch),
        Math.sin(gyroCurrent.pitch),
        Math.cos(gyroCurrent.yaw) * Math.cos(gyroCurrent.pitch),
      ).multiplyScalar(orbitRadius);

      camera.position.lerp(desired, 0.08);
      camera.lookAt(controls.target);
      controls.update();

      diskMaterial.uniforms.uTime.value = elapsed;
      starMaterial.uniforms.uTime.value = elapsed;
      eventHorizonMat.uniforms.uTime.value = elapsed;
      eventHorizonMat.uniforms.uCameraPosition.value.copy(camera.position);

      blackHoleScreenPos.copy(blackHoleMesh.position).project(camera);
      lensingPass.uniforms.blackHoleScreenPos.value.set(
        (blackHoleScreenPos.x + 1) / 2,
        (blackHoleScreenPos.y + 1) / 2,
      );

      stars.rotation.y += delta * 0.003;
      accretionDisk.rotation.z += delta * 0.005;
      composer.render(delta);
    };
    animate();

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      controls.dispose();
      composer.dispose();

      scene.remove(stars, eventHorizon, blackHoleMesh, accretionDisk, gridHelper);
      starGeometry.dispose();
      starMaterial.dispose();
      eventHorizonGeom.dispose();
      eventHorizonMat.dispose();
      blackHoleGeom.dispose();
      blackHoleMat.dispose();
      diskGeometry.dispose();
      diskMaterial.dispose();
      gridHelper.geometry.dispose();
      (gridHelper.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={rootRef} className={className} />;
});

