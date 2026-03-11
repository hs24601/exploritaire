import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type VertexDepthConfig = {
  amplitude: number;
  animationSpeed: number;
  particleSize: number;
  zRange: number;
  imageSrc: string;
  weightR: number;
  weightG: number;
  weightB: number;
  autoAnimate: boolean;
};

export const DEFAULT_VERTEX_DEPTH_CONFIG: VertexDepthConfig = {
  amplitude: 0.5,
  animationSpeed: 0.03,
  particleSize: 1.0,
  zRange: 400,
  imageSrc: '/assets/vis/textures/tree-star.jpg',
  weightR: 0.2126,
  weightG: 0.7152,
  weightB: 0.0722,
  autoAnimate: true
};

const vertexShader = `
  uniform float uAmplitude;
  uniform float uPointSize;
  attribute vec3 customColor;
  varying vec3 vColor;

  void main() {
    vColor = customColor;
    vec4 pos = vec4(position, 1.0);
    pos.z *= uAmplitude;

    vec4 mvPosition = modelViewMatrix * pos;
    gl_PointSize = uPointSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

type Props = {
  config?: VertexDepthConfig;
};

export const VertexDepthShaderDemo = memo(function VertexDepthShaderDemo({ 
  config = DEFAULT_VERTEX_DEPTH_CONFIG 
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const animationTimeRef = useRef(0);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(20, mount.clientWidth / mount.clientHeight, 1, 10000);
    camera.position.z = 3000;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 1);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Load Image and Create Particles
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'Anonymous';
    
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = config.imageSrc;
    
    let geometry: THREE.BufferGeometry | null = null;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;

      const width = 640;
      const height = 360;
      canvas.width = width;
      canvas.height = height;
      
      context.drawImage(image, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height).data;

      const particleCount = width * height;
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      let idx = 0;
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          const r = imageData[idx * 4] / 255;
          const g = imageData[idx * 4 + 1] / 255;
          const b = imageData[idx * 4 + 2] / 255;

          const luminance = r * config.weightR + g * config.weightG + b * config.weightB;

          // Position
          positions[idx * 3] = j - width / 2;
          positions[idx * 3 + 1] = (height / 2) - i;
          positions[idx * 3 + 2] = (luminance - 0.5) * config.zRange;

          // Color
          colors[idx * 3] = r;
          colors[idx * 3 + 1] = g;
          colors[idx * 3 + 2] = b;

          idx++;
        }
      }

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uAmplitude: { value: config.amplitude },
          uPointSize: { value: config.particleSize }
        },
        vertexShader,
        fragmentShader,
        transparent: true
      });
      materialRef.current = material;

      const points = new THREE.Points(geometry, material);
      pointsRef.current = points;
      scene.add(points);
    };

    let rafId = 0;
    const animate = () => {
      if (pointsRef.current && materialRef.current) {
        if (config.autoAnimate) {
          animationTimeRef.current += config.animationSpeed;
          materialRef.current.uniforms.uAmplitude.value = Math.sin(animationTimeRef.current);
        } else {
          materialRef.current.uniforms.uAmplitude.value = config.amplitude;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    const handleResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(rafId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      if (geometry) geometry.dispose();
      if (materialRef.current) materialRef.current.dispose();
      renderer.dispose();
    };
  }, [config.imageSrc, config.zRange, config.weightR, config.weightG, config.weightB]);

  // Update uniforms when config changes without full re-init
  useEffect(() => {
    if (materialRef.current) {
      if (!config.autoAnimate) {
        materialRef.current.uniforms.uAmplitude.value = config.amplitude;
      }
      materialRef.current.uniforms.uPointSize.value = config.particleSize;
    }
  }, [config.amplitude, config.autoAnimate, config.particleSize]);

  return <div ref={rootRef} className="w-full h-full" />;
});
