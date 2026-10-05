import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

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
        intensity = smoothstep(0.3, 0.8, intensity); 
        vec3 finalColor = mix(colorLow, colorHigh, intensity);
        float viewDot = dot(vNormal, vec3(0.0, 0.0, 1.0));
        float fresnel = pow(1.0 - abs(viewDot), 2.0);
        
        finalColor += colorHigh * fresnel * 0.25; 
        finalColor *= (0.3 + heat * 0.2); 
        
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
        core = pow(core, 2.0);
        
        vec3 finalColor = color * (core + flow * 0.8);
        float alpha = core * opacity * (0.5 + flow * 0.5);
        
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
        vec3 lightPos = vec3(5.0, 5.0, 10.0);
        vec3 lightDir = normalize(lightPos);
        vec3 halfVector = normalize(lightDir + viewDir);
        float NdotH = dot(normal, halfVector);
        float specular = pow(max(0.0, NdotH), 64.0);
        float noise = snoise(vec3(vUv * 8.0, time * 0.2)) * 0.05;
        vec3 baseGlow = color * (fresnel + noise * 2.0) * intensity;
        vec3 highlight = vec3(1.0) * specular * 0.9;
        vec3 finalColor = baseGlow + highlight;
        float alpha = fresnel * 0.7 + specular * 0.6 + 0.05;
        gl_FragColor = vec4(finalColor, alpha);
    }
`;

const particleVertex = `
    uniform float time;
    uniform float size;
    attribute float aRandom;
    varying float vAlpha;
    void main() {
        vec3 pos = position;
        float angle = time * (0.1 + aRandom * 0.2);
        float c = cos(angle); float s = sin(angle);
        pos.x = position.x * c - position.z * s;
        pos.z = position.x * s + position.z * c;
        
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * (1.0 + sin(time * 2.0 + aRandom * 10.0) * 0.5) * (4.0 / -mv.z);
        vAlpha = 0.5 + 0.5 * sin(time + aRandom * 20.0);
    }
`;

const particleFragment = `
    uniform vec3 color;
    varying float vAlpha;
    void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if(d > 0.5) discard;
        gl_FragColor = vec4(color, vAlpha * (1.0 - d*2.0));
    }
`;

// --- TYPES & DEFAULTS ---

export type SolarDynamicsTheme = 'helios' | 'neutron' | 'crimson';

export type SolarDynamicsConfig = {
    theme: SolarDynamicsTheme;
    heat: number;
    flux: number;
    corona: number;
};

export const DEFAULT_SOLAR_DYNAMICS_CONFIG: SolarDynamicsConfig = {
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
    config?: SolarDynamicsConfig;
};

export const SolarDynamicsEffect = memo(function SolarDynamicsEffect({ 
    className, 
    config = DEFAULT_SOLAR_DYNAMICS_CONFIG 
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const colors = THEME_PALETTES[config.theme];
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(new THREE.Color(colors.bg), 0.02);

        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.z = 4.5;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // --- SUN SURFACE ---
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

        // --- ATMOSPHERE ---
        const atmosGeo = new THREE.IcosahedronGeometry(2.3, 40);
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

        // --- MAGNETIC LOOPS ---
        const loops = new THREE.Group();
        scene.add(loops);
        const loopCount = 15;
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

        const loopData: any[] = [];
        for(let i=0; i<loopCount; i++) {
            const curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)
            );
            const geo = new THREE.TubeGeometry(curve, 20, 0.04, 4, false);
            const loop = new THREE.Mesh(geo, loopMat.clone());
            
            const u = {
                phase: Math.random() * Math.PI * 2,
                speed: 0.2 + Math.random() * 0.5,
                radius: 1.7,
                theta1: Math.random() * Math.PI * 2,
                phi1: Math.acos(2 * Math.random() - 1),
                theta2: 0, 
                phi2: 0,
                height: 0.8 + Math.random() * 1.5
            };
            u.theta2 = u.theta1 + (Math.random()-0.5) * 1.0;
            u.phi2 = u.phi1 + (Math.random()-0.5) * 1.0;
            
            loop.userData = u;
            loops.add(loop);
            loopData.push(u);
        }

        // --- PARTICLES ---
        const particleCount = 800;
        const particlesGeo = new THREE.BufferGeometry();
        const posArray = new Float32Array(particleCount * 3);
        const randomArray = new Float32Array(particleCount);
        for(let i=0; i<particleCount; i++) {
            const r = 2.5 + Math.random() * 3.0;
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
                size: { value: 4.0 * window.devicePixelRatio }
            },
            vertexShader: particleVertex,
            fragmentShader: particleFragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const particles = new THREE.Points(particlesGeo, particleMat);
        scene.add(particles);

        let rafId: number;
        const clock = new THREE.Clock();

        const animate = () => {
            rafId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            sunMat.uniforms.time.value = time;
            atmosMat.uniforms.time.value = time;
            particleMat.uniforms.time.value = time;
            scene.rotation.y = time * 0.02;

            // Update Loops
            loops.children.forEach(child => {
                const loop = child as THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>;
                const u = loop.userData;
                const r = u.radius;
                const t1 = u.theta1 + time * 0.05;
                const p1_ang = u.phi1;
                const p1 = new THREE.Vector3(r * Math.sin(p1_ang) * Math.cos(t1), r * Math.cos(p1_ang), r * Math.sin(p1_ang) * Math.sin(t1));
                const p2 = new THREE.Vector3(r * Math.sin(u.phi2) * Math.cos(u.theta2), r * Math.cos(u.phi2), r * Math.sin(u.phi2) * Math.sin(u.theta2));
                const mid = p1.clone().add(p2).multiplyScalar(0.5).normalize();
                const h = u.height * (1 + Math.sin(time * u.speed + u.phase) * 0.2) * config.flux;
                const c1 = p1.clone().add(mid.clone().multiplyScalar(h));
                const c2 = p2.clone().add(mid.clone().multiplyScalar(h));
                const newCurve = new THREE.CubicBezierCurve3(p1, c1, c2, p2);
                
                loop.geometry.dispose();
                loop.geometry = new THREE.TubeGeometry(newCurve, 20, 0.03 + config.flux * 0.03, 4, false);
                loop.material.uniforms.time.value = time;
                loop.material.uniforms.opacity.value = 0.3 + 0.7 * Math.sin(time * u.speed + u.phase);
            });

            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleResize);
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
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: solar_dynamics</div>
            </div>
        </div>
    );
});
