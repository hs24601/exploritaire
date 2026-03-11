import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- SHADERS ---

const noise3D = `
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }
`;

const sunVertex = `
    uniform float time;
    uniform float heat;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vNoise;
    
    ${noise3D}

    void main() {
        vUv = uv;
        vNormal = normal;
        float n = snoise(position * 1.5 + vec3(time * 0.2));
        vNoise = n;
        vec3 newPos = position + normal * n * 0.1 * heat;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
`;

const sunFragment = `
    uniform float time;
    uniform vec3 colorLow;
    uniform vec3 colorHigh;
    uniform float heat;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vNoise;

    void main() {
        float intensity = vNoise * 0.5 + 0.5;
        intensity = smoothstep(0.2, 0.9, intensity); 
        vec3 finalColor = mix(colorLow, colorHigh, intensity);
        
        // Center brightness boost to match protocode
        float centerGlow = pow(1.0 - length(vUv - 0.5) * 2.0, 2.0);
        finalColor += vec3(1.0) * centerGlow * 0.5;
        
        float viewDot = dot(vNormal, vec3(0.0, 0.0, 1.0));
        float fresnel = pow(1.0 - abs(viewDot), 2.0);
        
        finalColor += colorHigh * fresnel * 0.4; 
        finalColor *= (0.5 + heat * 0.3); 
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const tubeVertex = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const tubeFragment = `
    uniform float time;
    uniform vec3 color;
    uniform float opacity;
    varying vec2 vUv;

    void main() {
        float flow = sin(vUv.x * 15.0 - time * 8.0) * 0.5 + 0.5;
        float core = 1.0 - abs(vUv.y - 0.5) * 2.0;
        core = pow(core, 3.0);
        
        vec3 finalColor = color * (core + flow * 0.8);
        float alpha = core * opacity * (0.4 + flow * 0.6);
        
        gl_FragColor = vec4(finalColor, alpha);
    }
`;

const atmosVertex = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const atmosFragment = `
    uniform vec3 color;
    uniform float intensity;
    uniform float time;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    
    ${noise3D} 

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - dot(normal, viewDir), 3.0);
        
        float noise = snoise(vec3(vUv * 8.0, time * 0.2)) * 0.05;
        vec3 baseGlow = color * (fresnel + noise * 2.0) * intensity;
        
        vec3 lightPos = vec3(5.0, 5.0, 10.0);
        vec3 lightDir = normalize(lightPos);
        vec3 halfVector = normalize(lightDir + viewDir);
        float NdotH = dot(normal, halfVector);
        float specular = pow(max(0.0, NdotH), 64.0);
        
        vec3 finalColor = baseGlow + vec3(1.0) * specular * 0.8;
        float alpha = fresnel * 0.6 * intensity + specular * 0.5 + 0.02;
        
        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// --- TYPES & DEFAULTS ---

export type SuperNovaTheme = 'helios' | 'neutron' | 'crimson';

export type SuperNovaConfig = {
    theme: SuperNovaTheme;
    heat: number;
    flux: number;
    corona: number;
};

export const DEFAULT_SUPER_NOVA_CONFIG: SuperNovaConfig = {
    theme: 'helios',
    heat: 1.0,
    flux: 0.8,
    corona: 0.6
};

const THEME_PALETTES = {
    helios: {
        core: '#ffaa00',
        surfaceLow: '#ff4400',
        surfaceHigh: '#ffffaa',
        atmosphere: '#ff8800',
        flare: '#ffdd44',
        loop: '#00ffff', 
        bg: '#050200'
    },
    neutron: {
        core: '#0088ff',
        surfaceLow: '#001144',
        surfaceHigh: '#00ffff',
        atmosphere: '#0066ff',
        flare: '#aaddff',
        loop: '#ffaa00', 
        bg: '#000205'
    },
    crimson: {
        core: '#880000',
        surfaceLow: '#220000',
        surfaceHigh: '#ff2200',
        atmosphere: '#550000',
        flare: '#ff4444',
        loop: '#00ffaa', 
        bg: '#000000'
    }
};

type Props = {
    className?: string;
    config?: SuperNovaConfig;
};

export const SuperNovaEffect = memo(function SuperNovaEffect({ 
    className, 
    config = DEFAULT_SUPER_NOVA_CONFIG 
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mouse = useRef(new THREE.Vector2());
    const raycaster = useRef(new THREE.Raycaster());

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const colors = THEME_PALETTES[config.theme];
        const scene = new THREE.Scene();
        
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.z = 4.5;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);

        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(container.clientWidth, container.clientHeight),
            1.5,
            0.4,
            0.85
        );
        composer.addPass(bloomPass);

        const sunGeo = new THREE.IcosahedronGeometry(1.8, 64);
        const sunMat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                heat: { value: config.heat },
                colorLow: { value: new THREE.Color(colors.surfaceLow) },
                colorHigh: { value: new THREE.Color(colors.surfaceHigh) }
            },
            vertexShader: sunVertex,
            fragmentShader: sunFragment
        });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        scene.add(sun);

        const atmosGeo = new THREE.IcosahedronGeometry(2.1, 40);
        const atmosMat = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(colors.atmosphere) },
                intensity: { value: config.corona },
                time: { value: 0 }
            },
            vertexShader: atmosVertex,
            fragmentShader: atmosFragment,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
        scene.add(atmosphere);

        const loops = new THREE.Group();
        scene.add(loops);
        const loopCount = 12;
        const loopMat = new THREE.ShaderMaterial({ 
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(colors.loop) },
                opacity: { value: 0.6 }
            },
            vertexShader: tubeVertex,
            fragmentShader: tubeFragment,
            transparent: true, 
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        for(let i=0; i<loopCount; i++) {
            const curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)
            );
            const geo = new THREE.TubeGeometry(curve, 20, 0.02, 4, false);
            const loop = new THREE.Mesh(geo, loopMat.clone());
            
            const u = {
                phase: Math.random() * Math.PI * 2,
                speed: 0.2 + Math.random() * 0.5,
                radius: 1.75,
                theta1: Math.random() * Math.PI * 2,
                phi1: Math.acos(2 * Math.random() - 1),
                theta2: 0, 
                phi2: 0,
                height: 0.5 + Math.random() * 1.0
            };
            u.theta2 = u.theta1 + (Math.random()-0.5) * 1.5;
            u.phi2 = u.phi1 + (Math.random()-0.5) * 1.5;
            
            loop.userData = u;
            loops.add(loop);
        }

        const particleCount = 400;
        const particlesGeo = new THREE.BufferGeometry();
        const posArray = new Float32Array(particleCount * 3);
        const randomArray = new Float32Array(particleCount);
        for(let i=0; i<particleCount; i++) {
            const r = 2.2 + Math.random() * 2.0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            posArray[i*3] = r * Math.sin(phi) * Math.cos(theta);
            posArray[i*3+1] = r * Math.cos(phi);
            posArray[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
            randomArray[i] = Math.random();
        }
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        particlesGeo.setAttribute('aRandom', new THREE.BufferAttribute(randomArray, 1));
        const particleMat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(colors.flare) },
                size: { value: 3.0 * window.devicePixelRatio }
            },
            vertexShader: `
                uniform float time;
                uniform float size;
                attribute float aRandom;
                varying float vAlpha;
                void main() {
                    vec3 pos = position;
                    float angle = time * (0.05 + aRandom * 0.1);
                    float c = cos(angle); float s = sin(angle);
                    pos.x = position.x * c - position.z * s;
                    pos.z = position.x * s + position.z * c;
                    
                    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mv;
                    gl_PointSize = size * (0.8 + sin(time * 2.0 + aRandom * 10.0) * 0.4) * (4.0 / -mv.z);
                    vAlpha = 0.3 + 0.7 * sin(time + aRandom * 20.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                varying float vAlpha;
                void main() {
                    float d = distance(gl_PointCoord, vec2(0.5));
                    if(d > 0.5) discard;
                    gl_FragColor = vec4(color, vAlpha * (1.0 - d*2.0));
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const particles = new THREE.Points(particlesGeo, particleMat);
        scene.add(particles);

        // --- EXPLOSIONS ---
        const explosions: any[] = [];
        const createExplosion = () => {
            const group = new THREE.Group();
            const coreGeo = new THREE.SphereGeometry(1.8, 32, 32); 
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
            const core = new THREE.Mesh(coreGeo, coreMat);
            group.add(core);

            const shockGeo = new THREE.SphereGeometry(1.9, 32, 32);
            const shockMat = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color(colors.flare), 
                transparent: true, 
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide
            });
            const shockwave = new THREE.Mesh(shockGeo, shockMat);
            group.add(shockwave);

            const debrisCount = 120;
            const debrisGeo = new THREE.BufferGeometry();
            const debrisPos = [];
            const debrisVel = [];
            for(let i=0; i<debrisCount; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = 1.8;
                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.cos(phi);
                const z = r * Math.sin(phi) * Math.sin(theta);
                debrisPos.push(x, y, z);
                const speed = 0.5 + Math.random() * 2.0;
                const vel = new THREE.Vector3(x, y, z).normalize().multiplyScalar(speed);
                debrisVel.push(vel.x, vel.y, vel.z);
            }
            debrisGeo.setAttribute('position', new THREE.Float32BufferAttribute(debrisPos, 3));
            const debrisMat = new THREE.PointsMaterial({ color: new THREE.Color(colors.surfaceHigh), size: 0.15, transparent: true, blending: THREE.AdditiveBlending });
            const debris = new THREE.Points(debrisGeo, debrisMat);
            debris.userData = { velocities: debrisVel };
            group.add(debris);

            const rayCount = 60;
            const raysGroup = new THREE.Group();
            const rayGeo = new THREE.CylinderGeometry(0.02, 0.08, 1, 8);
            rayGeo.translate(0, 0.5, 0); rayGeo.rotateX(Math.PI / 2); 
            const rayMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
            for(let i=0; i<rayCount; i++) {
                const ray = new THREE.Mesh(rayGeo, rayMat);
                const rTheta = Math.random() * Math.PI * 2;
                const rPhi = Math.acos(2 * Math.random() - 1);
                const x = Math.sin(rPhi) * Math.cos(rTheta);
                const y = Math.cos(rPhi);
                const z = Math.sin(rPhi) * Math.sin(rTheta);
                const dir = new THREE.Vector3(x, y, z);
                ray.position.copy(dir).multiplyScalar(1.75); 
                ray.lookAt(dir.clone().multiplyScalar(10)); 
                ray.scale.set(1, 1, 0.1); 
                raysGroup.add(ray);
            }
            group.add(raysGroup);
            scene.add(group);
            explosions.push({ group, core, ring: shockwave, debris, rays: raysGroup, age: 0, lifetime: 1.2 });
            
            const originalBloom = bloomPass.strength;
            bloomPass.strength = 2.5; 
            setTimeout(() => { bloomPass.strength = originalBloom; }, 200);
        };

        const onMouseMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        };

        const onMouseDown = () => {
            raycaster.current.setFromCamera(mouse.current, camera);
            const intersects = raycaster.current.intersectObject(sun);
            if (intersects.length > 0) {
                createExplosion();
            }
        };

        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mousedown', onMouseDown);

        let rafId: number;
        const clock = new THREE.Clock();

        const animate = () => {
            rafId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();
            const dt = clock.getDelta() || 0.016;

            sunMat.uniforms.time.value = time;
            atmosMat.uniforms.time.value = time;
            particleMat.uniforms.time.value = time;
            scene.rotation.y = time * 0.01;

            loops.children.forEach(child => {
                const loop = child as THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>;
                const u = loop.userData;
                const r = u.radius;
                const t1 = u.theta1 + time * 0.02;
                const p1_ang = u.phi1;
                const p1 = new THREE.Vector3(r * Math.sin(p1_ang) * Math.cos(t1), r * Math.cos(p1_ang), r * Math.sin(p1_ang) * Math.sin(t1));
                const p2 = new THREE.Vector3(r * Math.sin(u.phi2) * Math.cos(u.theta2), r * Math.cos(u.phi2), r * Math.sin(u.phi2) * Math.sin(u.theta2));
                const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize();
                const h = u.height * (1 + Math.sin(time * u.speed + u.phase) * 0.2) * config.flux;
                const c1 = p1.clone().add(mid.clone().multiplyScalar(h));
                const c2 = p2.clone().add(mid.clone().multiplyScalar(h));
                const newCurve = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                loop.geometry.dispose();
                loop.geometry = new THREE.TubeGeometry(newCurve, 20, 0.01 + config.flux * 0.02, 4, false);
                loop.material.uniforms.time.value = time;
                loop.material.uniforms.opacity.value = 0.2 + 0.8 * Math.sin(time * u.speed + u.phase);
            });

            for (let i = explosions.length - 1; i >= 0; i--) {
                const ex = explosions[i];
                ex.age += dt;
                const progress = ex.age / ex.lifetime;
                if (progress >= 1.0) {
                    scene.remove(ex.group);
                    explosions.splice(i, 1);
                    continue;
                }
                ex.core.scale.setScalar(1.0 + progress * 0.5);
                ex.core.material.opacity = 1.0 - progress;
                ex.ring.scale.setScalar(1.0 + progress * 2.0);
                ex.ring.material.opacity = (1.0 - progress) * 0.8;
                ex.rays.children.forEach((ray: THREE.Mesh) => {
                    ray.scale.z = 1.0 + progress * 15.0; 
                    ray.scale.x = ray.scale.y = 1.0 - progress; 
                    (ray.material as THREE.MeshBasicMaterial).opacity = 1.0 - Math.pow(progress, 0.5);
                });
                const positions = ex.debris.geometry.attributes.position.array;
                const vels = ex.debris.userData.velocities;
                for(let j=0; j < vels.length / 3; j++) {
                    positions[j*3] += vels[j*3];
                    positions[j*3+1] += vels[j*3+1];
                    positions[j*3+2] += vels[j*3+2];
                }
                ex.debris.geometry.attributes.position.needsUpdate = true;
                ex.debris.material.opacity = 1.0 - progress;
            }

            composer.render();
        };
        animate();

        const handleResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleResize);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mousedown', onMouseDown);
            sunGeo.dispose(); sunMat.dispose();
            atmosGeo.dispose(); atmosMat.dispose();
            loopMat.dispose(); loops.children.forEach(l => (l as THREE.Mesh).geometry.dispose());
            particlesGeo.dispose(); particleMat.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [config]);

    return (
        <div className={`w-full h-full bg-transparent flex items-center justify-center ${className ?? ''}`}>
            <div ref={containerRef} className="w-full h-full" />
            <div className="absolute bottom-4 right-4 pointer-events-none">
                <div className="text-game-teal font-mono text-[9px] uppercase tracking-widest opacity-40 bg-black/40 px-2 py-1 rounded border border-game-teal/20">Click surface to eject mass</div>
            </div>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: super_nova</div>
            </div>
        </div>
    );
});
