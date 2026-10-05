import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface QuasarBeamConfig {
  starCount: number;
  starSpeed: number;
  enableStars: boolean;
  earthSpeed: number;
  enableEarth: boolean;
  diskSpeed: number;
  jetSpeed: number;
  jetColor: string;
  diskColor: string;
  coreColor: string;
}

export const DEFAULT_QUASAR_BEAM_CONFIG: QuasarBeamConfig = {
  starCount: 10000,
  starSpeed: 0.0002,
  enableStars: true,
  earthSpeed: 0.0018,
  enableEarth: true,
  diskSpeed: 0.0012,
  jetSpeed: 0.05,
  jetColor: '#00ffff',
  diskColor: '#fff066',
  coreColor: '#ffff99',
};

export function QuasarBeamEffect({ config = DEFAULT_QUASAR_BEAM_CONFIG }: { config?: QuasarBeamConfig }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000022);

    // CAMERA
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 6000);
    camera.position.set(0, 18, 95);

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // STARS
    const starGroup = new THREE.Group();
    if (config.enableStars) {
      scene.add(starGroup);
      const starGeo = new THREE.BufferGeometry();
      const starPos = [];
      for (let i = 0; i < config.starCount; i++) {
        starPos.push(
          (Math.random() - 0.5) * 4000,
          (Math.random() - 0.5) * 4000,
          (Math.random() - 0.5) * 4000
        );
      }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      starGroup.add(
        new THREE.Points(
          starGeo,
          new THREE.PointsMaterial({ color: 0xffffff, size: 0.2 })
        )
      );
    }

    // EARTH
    const earthGroup = new THREE.Group();
    let earth: THREE.Mesh | null = null;
    let clouds: THREE.Mesh | null = null;

    if (config.enableEarth) {
      scene.add(earthGroup);
      const loader = new THREE.TextureLoader();
      
      const earthMap = loader.load('https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg');
      const earthBump = loader.load('https://www.solarsystemscope.com/textures/download/2k_earth_bump.jpg');
      const earthClouds = loader.load('https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg');

      earth = new THREE.Mesh(
        new THREE.SphereGeometry(5, 64, 64),
        new THREE.MeshPhongMaterial({
          map: earthMap,
          bumpMap: earthBump,
          bumpScale: 0.04
        })
      );
      earthGroup.add(earth);

      clouds = new THREE.Mesh(
        new THREE.SphereGeometry(5.06, 64, 64),
        new THREE.MeshPhongMaterial({
          map: earthClouds,
          transparent: true,
          opacity: 0.7
        })
      );
      earth.add(clouds);
    }

    // LIGHT
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(120, 60, 40);
    scene.add(sun);

    // ACCRETION DISK
    const diskGroup = new THREE.Group();
    scene.add(diskGroup);
    
    const loader = new THREE.TextureLoader();
    const diskTexture = loader.load('https://threejs.org/examples/textures/lava/cloud.png');
    diskTexture.wrapS = diskTexture.wrapT = THREE.RepeatWrapping;
    diskTexture.repeat.set(3, 3);

    const diskMaterial = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: diskTexture },
        color: { value: new THREE.Color(config.diskColor) },
        opacity: { value: 0.55 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform vec3 color;
        uniform float opacity;
        varying vec2 vUv;

        void main(){
          vec2 c = vUv - 0.5;
          float r = length(c) * 2.0;
          float mask = smoothstep(1.0, 0.55, r);
          float tex = texture2D(map, vUv).r;
          gl_FragColor = vec4(color, tex * mask * opacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const disk = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), diskMaterial);
    disk.rotation.x = Math.PI / 2;
    diskGroup.add(disk);

    const coreMaterial = diskMaterial.clone();
    coreMaterial.uniforms.opacity.value = 0.7;
    coreMaterial.uniforms.color.value = new THREE.Color(config.coreColor);
    
    const core = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), coreMaterial);
    core.rotation.x = Math.PI / 2;
    diskGroup.add(core);

    // JETS
    const jetGroup = new THREE.Group();
    scene.add(jetGroup);

    const createJet = (dir: number, offset: number) => {
      const count = 4000;
      const pos = new Float32Array(count * 3);
      const size = new Float32Array(count);
      const alpha = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = t * Math.PI * 20 + offset;
        const radius = (1 - t) * 5;

        pos[i * 3] = Math.sin(angle) * radius;
        pos[i * 3 + 1] = t * 130 * dir;
        pos[i * 3 + 2] = Math.cos(angle) * radius;

        size[i] = 2.5 * (1 - t);
        alpha[i] = 0.03 * (1 - t);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
      geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(config.jetColor) }
        },
        vertexShader: `
          attribute float size;
          attribute float alpha;
          varying float vAlpha;
          void main(){
            vAlpha = alpha;
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            gl_PointSize = size * (300.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float f = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(uColor, f * vAlpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      jetGroup.add(new THREE.Points(geo, mat));
    };

    createJet(1, 0);
    createJet(1, Math.PI / 3);
    createJet(1, Math.PI * 2 / 3);
    createJet(-1, 0);
    createJet(-1, Math.PI / 3);
    createJet(-1, Math.PI * 2 / 3);

    // ANIMATION
    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);

      if (earth && clouds && config.enableEarth) {
          earth.rotation.y += config.earthSpeed;
          clouds.rotation.y += config.earthSpeed * 1.2;
      }

      diskGroup.rotation.y += config.diskSpeed;
      jetGroup.rotation.y += config.jetSpeed;
      if (config.enableStars) {
        starGroup.rotation.y += config.starSpeed;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      // Cleanup
      starGroup.clear();
      earthGroup.clear();
      diskGroup.clear();
      jetGroup.clear();
      renderer.dispose();
    };
  }, [config]);

  return (
    <div className="w-full h-full bg-black/80 flex items-center justify-center relative">
      <div ref={mountRef} className="w-full h-full absolute inset-0" />
      <div className="absolute top-4 left-4 pointer-events-none z-10">
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: quasar_beam</div>
      </div>
    </div>
  );
}
