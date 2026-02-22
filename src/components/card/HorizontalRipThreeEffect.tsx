import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import html2canvas from 'html2canvas';

interface HorizontalRipThreeEffectProps {
  sourceRef: RefObject<HTMLDivElement | null>;
  trigger: number;
  width: number;
  height: number;
  onSnapshotReady?: () => void;
}

const VERTEX_SHADER = `
uniform float uProgress;
uniform float uIsTop;
uniform float uSeed;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;
  float seamFalloff = uIsTop > 0.5 ? (1.0 - uv.y) : uv.y;
  seamFalloff = pow(clamp(seamFalloff, 0.0, 1.0), 1.45);
  float noise = sin((uv.x * 26.0) + uSeed) * 0.013 + sin((uv.x * 63.0) - (uSeed * 1.7)) * 0.008;
  pos.z += seamFalloff * uProgress * 0.05;
  pos.x += noise * seamFalloff * uProgress * 0.12;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform sampler2D uMap;
uniform float uIsTop;
uniform float uProgress;
uniform float uSeed;
varying vec2 vUv;

float jag(float x) {
  return sin((x * 33.0) + uSeed) * 0.55 + sin((x * 91.0) - (uSeed * 0.7)) * 0.35;
}

void main() {
  vec2 uv = vec2(vUv.x, uIsTop > 0.5 ? (0.5 + (vUv.y * 0.5)) : (vUv.y * 0.5));
  vec4 base = texture2D(uMap, uv);
  float tearEdge = 0.015 + (jag(vUv.x) * 0.012);

  float seamY;
  if (uIsTop > 0.5) {
    seamY = max(0.0, tearEdge);
  } else {
    seamY = min(1.0, 1.0 - tearEdge);
  }

  float distToSeam = abs(vUv.y - seamY);
  float cutHalfWidth = 0.011 + (uProgress * 0.004);
  if (distToSeam < cutHalfWidth) {
    discard;
  }

  float paperEdgeBand = smoothstep(0.032, 0.012, distToSeam);
  float grain = 0.5 + (0.5 * sin((vUv.x * 210.0) + (uSeed * 1.3)));
  vec3 paperEdge = mix(vec3(0.86), vec3(0.97), grain);
  base.rgb = mix(base.rgb, paperEdge, paperEdgeBand * 0.7);

  float shadowBand = smoothstep(0.065, 0.025, distToSeam);
  base.rgb *= (1.0 - (shadowBand * 0.06));
  gl_FragColor = base;
}
`;

export function HorizontalRipThreeEffect({
  sourceRef,
  trigger,
  width,
  height,
  onSnapshotReady,
}: HorizontalRipThreeEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const topMeshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null>(null);
  const bottomMeshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTriggerRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!rendererRef.current) {
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        alpha: true,
        antialias: true,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;
      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
      cameraRef.current.position.z = 2;
    }

    rendererRef.current.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), false);
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }, [width, height]);

  useEffect(() => {
    const sourceEl = sourceRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!sourceEl || !renderer || !scene || !camera) return;
    if (trigger <= 0 || trigger === lastTriggerRef.current) return;
    lastTriggerRef.current = trigger;

    const run = async () => {
      const snapshotCanvas = await html2canvas(sourceEl, {
        backgroundColor: null,
        scale: 1,
        useCORS: true,
        logging: false,
      });
      onSnapshotReady?.();

      if (textureRef.current) {
        textureRef.current.dispose();
      }
      textureRef.current = new THREE.CanvasTexture(snapshotCanvas);
      textureRef.current.colorSpace = THREE.SRGBColorSpace;
      textureRef.current.minFilter = THREE.LinearFilter;
      textureRef.current.magFilter = THREE.LinearFilter;

      if (topMeshRef.current) {
        scene.remove(topMeshRef.current);
        topMeshRef.current.geometry.dispose();
        topMeshRef.current.material.dispose();
      }
      if (bottomMeshRef.current) {
        scene.remove(bottomMeshRef.current);
        bottomMeshRef.current.geometry.dispose();
        bottomMeshRef.current.material.dispose();
      }

      const seed = Math.random() * 1000;
      const makeMaterial = (isTop: 0 | 1) => new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uMap: { value: textureRef.current },
          uProgress: { value: 0 },
          uIsTop: { value: isTop },
          uSeed: { value: seed },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      });

      const planeGeometry = new THREE.PlaneGeometry(2, 1, 48, 32);
      const topMesh = new THREE.Mesh(planeGeometry, makeMaterial(1));
      const bottomMesh = new THREE.Mesh(planeGeometry.clone(), makeMaterial(0));
      topMesh.position.y = 0.5;
      bottomMesh.position.y = -0.5;

      topMeshRef.current = topMesh;
      bottomMeshRef.current = bottomMesh;
      scene.add(topMesh);
      scene.add(bottomMesh);

      const durationMs = 760;
      const start = performance.now();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      const animate = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = t * t * (3 - (2 * t));
        const bell = Math.exp(-Math.pow((t - 0.52) / 0.23, 2));
        const gap = eased * 0.2;
        const extraLift = bell * 0.06;

        topMesh.material.uniforms.uProgress.value = eased;
        bottomMesh.material.uniforms.uProgress.value = eased;
        topMesh.position.y = 0.5 + gap + extraLift;
        bottomMesh.position.y = -0.5 - gap - (extraLift * 0.9);
        topMesh.rotation.x = -0.06 * eased - (0.18 * bell);
        bottomMesh.rotation.x = 0.06 * eased + (0.18 * bell);
        topMesh.rotation.z = -0.012 * eased;
        bottomMesh.rotation.z = 0.012 * eased;
        topMesh.position.z = 0.03;
        bottomMesh.position.z = 0.02;

        renderer.render(scene, camera);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    };

    run().catch(() => {
      // Ignore snapshot/render failures and leave the original DOM card visible.
    });
  }, [onSnapshotReady, sourceRef, trigger]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (topMeshRef.current) {
        topMeshRef.current.geometry.dispose();
        topMeshRef.current.material.dispose();
      }
      if (bottomMeshRef.current) {
        bottomMeshRef.current.geometry.dispose();
        bottomMeshRef.current.material.dispose();
      }
      textureRef.current?.dispose();
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[60]"
      width={Math.max(1, Math.round(width))}
      height={Math.max(1, Math.round(height))}
    />
  );
}
