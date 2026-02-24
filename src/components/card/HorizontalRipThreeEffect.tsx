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

const RIP_TEX_URL = 'https://assets.codepen.io/557388/rip.jpg';

const RIP_VERTEX_SHADER = `
uniform float uTearAmount;
uniform float uTearWidth;
uniform float uTearXAngle;
uniform float uTearYAngle;
uniform float uTearZAngle;
uniform float uTearXOffset;
uniform float uHalfHeight;

varying vec2 vUv;
varying float vAmount;

mat4 rotationX(in float angle) {
  return mat4(
    1.0, 0.0, 0.0, 0.0,
    0.0, cos(angle), -sin(angle), 0.0,
    0.0, sin(angle), cos(angle), 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

mat4 rotationY(in float angle) {
  return mat4(
    cos(angle), 0.0, sin(angle), 0.0,
    0.0, 1.0, 0.0, 0.0,
    -sin(angle), 0.0, cos(angle), 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

mat4 rotationZ(in float angle) {
  return mat4(
    cos(angle), -sin(angle), 0.0, 0.0,
    sin(angle), cos(angle), 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}

void main() {
  // Match prototype falloff so the split opens widest near the origin.
  float yAmount = max(0.0, (uTearAmount - (1.0 - uv.y)));
  float zRotate = uTearZAngle * yAmount;
  float xRotate = uTearXAngle * yAmount;
  float yRotate = uTearYAngle * yAmount;

  vec4 vertex = vec4(position.x, position.y + uHalfHeight, position.z, 1.0);
  vertex = vertex * rotationY(yRotate) * rotationX(xRotate) * rotationZ(zRotate);
  vertex.x += uTearXOffset * yAmount;
  vertex.y -= uHalfHeight;

  vUv = uv;
  vAmount = yAmount;
  gl_Position = projectionMatrix * modelViewMatrix * vertex;
}
`;

const RIP_FRAGMENT_SHADER = `
uniform sampler2D uMap;
uniform sampler2D uRip;
uniform float uUvOffset;
uniform float uRipSide;
uniform float uTearWidth;
uniform float uFullWidth;
uniform float uWhiteThreshold;
uniform float uTearOffset;

varying vec2 vUv;
varying float vAmount;

void main() {
  bool rightSide = uRipSide == 1.0;
  float halfWidth = uFullWidth * 0.5;
  float widthOverlap = halfWidth + (uTearWidth * 0.5);
  float xScale = widthOverlap / uFullWidth;
  vec2 uvOffset = vec2(vUv.x * xScale + uUvOffset, vUv.y);
  vec4 textureColor = texture2D(uMap, uvOffset);

  float ripRange = uTearWidth / widthOverlap;
  float ripStart = rightSide ? 0.0 : (1.0 - ripRange);
  float ripX = (vUv.x - ripStart) / ripRange;
  float ripY = (vUv.y * 0.5) + (0.5 * uTearOffset);
  float alpha = 1.0;
  bool inRipBand = (ripX >= 0.0 && ripX <= 1.0);
  if (inRipBand) {
    vec4 ripCut = texture2D(uRip, vec2(ripX, ripY));
    float whiteness = dot(vec4(1.0), ripCut) * 0.25;
    float edgeBand = 1.0 - smoothstep(0.0, 0.06, abs(whiteness - uWhiteThreshold));
    if (!rightSide && whiteness <= uWhiteThreshold) {
      alpha = 0.0;
    }
    if (rightSide && whiteness >= uWhiteThreshold) {
      alpha = 0.0;
    }
    if (alpha > 0.0 && edgeBand > 0.0) {
      textureColor.rgb = mix(textureColor.rgb, vec3(0.94), edgeBand * 0.35);
    }
  }

  gl_FragColor = vec4(textureColor.rgb, textureColor.a * alpha);
}
`;

type RipSide = 'left' | 'right';

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
  const mapTextureRef = useRef<THREE.Texture | null>(null);
  const ripTextureRef = useRef<THREE.Texture | null>(null);
  const leftMeshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null>(null);
  const rightMeshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null>(null);
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
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      rendererRef.current = renderer;
      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
      cameraRef.current.position.z = 2;
    }

    rendererRef.current.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), false);
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }, [width, height]);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(RIP_TEX_URL, (tex) => {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.NoColorSpace;
      ripTextureRef.current = tex;
    });
  }, []);

  useEffect(() => {
    const sourceEl = sourceRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const ripTex = ripTextureRef.current;
    if (!sourceEl || !renderer || !scene || !camera || !ripTex) return;
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

      if (mapTextureRef.current) mapTextureRef.current.dispose();
      mapTextureRef.current = new THREE.CanvasTexture(snapshotCanvas);
      mapTextureRef.current.colorSpace = THREE.SRGBColorSpace;
      mapTextureRef.current.minFilter = THREE.LinearFilter;
      mapTextureRef.current.magFilter = THREE.LinearFilter;

      if (leftMeshRef.current) {
        scene.remove(leftMeshRef.current);
        leftMeshRef.current.geometry.dispose();
        leftMeshRef.current.material.dispose();
      }
      if (rightMeshRef.current) {
        scene.remove(rightMeshRef.current);
        rightMeshRef.current.geometry.dispose();
        rightMeshRef.current.material.dispose();
      }

      const fullWidth = 2.0;
      const tearWidth = 0.07;
      const halfHeight = 1.0;
      const leftUvOffset = 0.0;
      const rightUvOffset = ((fullWidth - tearWidth) / fullWidth) * 0.5;
      const tearOffset = Math.random();

      const makeMaterial = (side: RipSide) => {
        const right = side === 'right';
        return new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: {
            uMap: { value: mapTextureRef.current },
            uRip: { value: ripTex },
            uUvOffset: { value: right ? rightUvOffset : leftUvOffset },
            uRipSide: { value: right ? 1 : 0 },
            uTearWidth: { value: tearWidth },
            uFullWidth: { value: fullWidth },
            uWhiteThreshold: { value: 0.76 },
            uTearOffset: { value: tearOffset },
            uTearAmount: { value: 0 },
            uTearXAngle: { value: right ? 0.07 : -0.07 },
            uTearYAngle: { value: right ? 0.02 : -0.02 },
            uTearZAngle: { value: right ? -0.03 : 0.03 },
            uTearXOffset: { value: 0 },
            uHalfHeight: { value: halfHeight },
          },
          vertexShader: RIP_VERTEX_SHADER,
          fragmentShader: RIP_FRAGMENT_SHADER,
        });
      };

      const sideWidth = (fullWidth * 0.5) + (tearWidth * 0.5);
      const geometry = new THREE.PlaneGeometry(sideWidth, 2.0, 50, 50);
      const leftMesh = new THREE.Mesh(geometry, makeMaterial('left'));
      const rightMesh = new THREE.Mesh(geometry.clone(), makeMaterial('right'));
      const baseX = (fullWidth - tearWidth) * 0.25;
      leftMesh.position.x = -baseX;
      rightMesh.position.x = baseX;
      leftMesh.position.z = 0.002;
      rightMesh.position.z = 0.003;
      leftMeshRef.current = leftMesh;
      rightMeshRef.current = rightMesh;
      scene.add(leftMesh);
      scene.add(rightMesh);

      const durationMs = 760;
      const start = performance.now();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      const animate = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = t * t * (3.0 - (2.0 * t));
        const bell = Math.exp(-Math.pow((t - 0.52) / 0.21, 2.0));
        const split = (eased * 0.005) + (bell * 0.003);
        const tearAmount = eased * 0.92;

        leftMesh.material.uniforms.uTearAmount.value = tearAmount;
        rightMesh.material.uniforms.uTearAmount.value = tearAmount;
        leftMesh.material.uniforms.uTearXOffset.value = -split;
        rightMesh.material.uniforms.uTearXOffset.value = split;

        renderer.render(scene, camera);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    };

    run().catch(() => {
      // Keep DOM card visible if rip setup fails.
    });
  }, [onSnapshotReady, sourceRef, trigger]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (leftMeshRef.current) {
        leftMeshRef.current.geometry.dispose();
        leftMeshRef.current.material.dispose();
      }
      if (rightMeshRef.current) {
        rightMeshRef.current.geometry.dispose();
        rightMeshRef.current.material.dispose();
      }
      mapTextureRef.current?.dispose();
      ripTextureRef.current?.dispose();
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
