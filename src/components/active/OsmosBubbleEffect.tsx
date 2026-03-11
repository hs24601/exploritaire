import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

// --- GLSL NOISE FUNCTIONS ---
const noiseFunctions = `
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute( permute( permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
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

    float fbm(vec3 p) {
        float total = 0.0;
        float amp = 0.5;
        for(int i = 0; i < 5; i++) {
            total += amp * snoise(p);
            p *= 2.0;
            amp *= 0.5;
        }
        return total;
    }
`;

// --- PLASMA SHADER ---
const plasmaVert = `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const plasmaFrag = `
    uniform float uTime;
    uniform float uScale;
    uniform float uBrightness;
    uniform float uVoidThreshold;
    uniform vec3 uColorDeep;
    uniform vec3 uColorMid;
    uniform vec3 uColorBright;
    varying vec2 vUv;
    varying vec3 vPosition;

    ${noiseFunctions}

    void main() {
        vec3 p = vPosition * uScale + uTime * 0.2;
        float n = fbm(p);
        
        float v = n * uBrightness;
        v = smoothstep(uVoidThreshold, 1.0, v);
        
        vec3 color = mix(uColorDeep, uColorMid, smoothstep(0.0, 0.5, v));
        color = mix(color, uColorBright, smoothstep(0.5, 1.0, v));
        
        gl_FragColor = vec4(color, v);
    }
`;

// --- SHELL SHADER ---
const shellVert = `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vViewDir = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const shellFrag = `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
        float fresnel = pow(1.0 - dot(vNormal, vViewDir), 3.0);
        gl_FragColor = vec4(uColor, fresnel * uOpacity);
    }
`;

export type OsmosBubbleConfig = {
    timeScale: number;
    rotationSpeedX: number;
    rotationSpeedY: number;
    plasmaScale: number;
    plasmaBrightness: number;
    voidThreshold: number;
    colorDeep: string;
    colorMid: string;
    colorBright: string;
    shellColor: string;
    shellOpacity: number;
    particleCount: number;
    particleSize: number;
};

export const DEFAULT_OSMOS_BUBBLE_CONFIG: OsmosBubbleConfig = {
    timeScale: 0.78,
    rotationSpeedX: 0.002,
    rotationSpeedY: 0.005,
    plasmaScale: 0.1404,
    plasmaBrightness: 1.31,
    voidThreshold: 0.072,
    colorDeep: '#001433',
    colorMid: '#0084ff',
    colorBright: '#00ffe1',
    shellColor: '#0066ff',
    shellOpacity: 0.41,
    particleCount: 400,
    particleSize: 0.015,
};

type Props = {
    className?: string;
    config?: OsmosBubbleConfig;
};

export const OsmosBubbleEffect = memo(function OsmosBubbleEffect({
    className,
    config = DEFAULT_OSMOS_BUBBLE_CONFIG
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.z = 2.4;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        container.appendChild(renderer.domElement);

        const mainGroup = new THREE.Group();
        scene.add(mainGroup);

        const plasmaGeo = new THREE.SphereGeometry(1, 64, 64);
        const plasmaMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uScale: { value: config.plasmaScale },
                uBrightness: { value: config.plasmaBrightness },
                uVoidThreshold: { value: config.voidThreshold },
                uColorDeep: { value: new THREE.Color(config.colorDeep) },
                uColorMid: { value: new THREE.Color(config.colorMid) },
                uColorBright: { value: new THREE.Color(config.colorBright) }
            },
            vertexShader: plasmaVert,
            fragmentShader: plasmaFrag,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const plasmaSphere = new THREE.Mesh(plasmaGeo, plasmaMat);
        mainGroup.add(plasmaSphere);

        const shellGeo = new THREE.SphereGeometry(1.02, 64, 64);
        const shellMat = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(config.shellColor) },
                uOpacity: { value: config.shellOpacity }
            },
            vertexShader: shellVert,
            fragmentShader: shellFrag,
            transparent: true,
            depthWrite: false
        });
        const shellSphere = new THREE.Mesh(shellGeo, shellMat);
        mainGroup.add(shellSphere);

        // --- PARTICLES ---
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(config.particleCount * 3);
        const randoms = new Float32Array(config.particleCount);

        for (let i = 0; i < config.particleCount; i++) {
            // Random point inside sphere
            const phi = Math.random() * Math.PI * 2;
            const costheta = Math.random() * 2 - 1;
            const u = Math.random();
            const theta = Math.acos(costheta);
            const r = Math.pow(u, 1/3) * 0.95; // Slightly smaller than bubble

            positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
            positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
            positions[i * 3 + 2] = r * Math.cos(theta);
            randoms[i] = Math.random();
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: config.particleSize,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        const particles = new THREE.Points(particleGeo, particleMat);
        mainGroup.add(particles);

        let rafId: number;
        const animate = (time: number) => {
            rafId = requestAnimationFrame(animate);
            
            const scaledTime = time * 0.001 * config.timeScale;
            plasmaMat.uniforms.uTime.value = scaledTime;
            
            mainGroup.rotation.x += config.rotationSpeedX;
            mainGroup.rotation.y += config.rotationSpeedY;
            
            renderer.render(scene, camera);
        };
        rafId = requestAnimationFrame(animate);

        const handleResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleResize);
            plasmaGeo.dispose();
            plasmaMat.dispose();
            shellGeo.dispose();
            shellMat.dispose();
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
                <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: osmos_bubble</div>
            </div>
        </div>
    );
});
