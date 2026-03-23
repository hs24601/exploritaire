import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

const fragmentShader = `
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform float iSpeed;
uniform float iComplexity;
uniform float iDetail;
uniform float iBrightness;
uniform float iZScale;
uniform vec3 iColorTint;

vec4 safe_tanh(vec4 x) {
    vec4 abs_x = abs(x);
    vec4 exp_neg_2_abs_x = exp(-2.0 * abs_x);
    return sign(x) * (1.0 - exp_neg_2_abs_x) / (1.0 + exp_neg_2_abs_x);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec3 r = iResolution;
    vec2 uv = fragCoord / r.xy;
    
    vec4 o = vec4(0.0);
    float z = 0.0;
    float s = 0.0;
    float d = 0.0;

    float t = iTime * iSpeed;

    for (float i = 1.0; i <= 150.0; i++) {
        if (i > iComplexity) break;
        
        vec3 dir = normalize(vec3(fragCoord, 0.0) * 2.0 - r.xyy);
        vec3 p = z * dir;
        p.z += 9.0;
        
        vec3 a = vec3(0.0);
        
        s -= t;
        float cosVal = cos(s);
        
        a -= 0.6;
        float dotA = dot(a, p);
        vec3 mixA = dotA * a;
        
        vec3 mixed = mix(mixA, p, cosVal);
        
        float sinVal = sin(s);
        vec3 crossAP = cross(a, p);
        vec3 subtractor = sinVal * crossAP;
        
        a = mixed - subtractor;
        
        s = sqrt(length(a - a.zxy));
        
        for (float dj = 1.0; dj <= 20.0; dj++) {
            if (dj > iDetail) break;
            a += cos(a * dj + t).yzx / dj;
        }
        
        float sumA = a.x + a.y + a.z;
        d = sumA;
        
        z += sqrt(max(d, -d * 0.1)) * s / 14.0;
        
        vec3 colorBase = vec3(s, 1.0, z / iZScale);
        o += vec4(colorBase * iColorTint, 1.0) / (s * s + 0.0001) * i;
    }
    
    o = safe_tanh(o * o / iBrightness);
    fragColor = o;
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const vertexShader = `
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export type BahamutBlastConfig = {
    speed: number;
    complexity: number;
    detail: number;
    brightness: number;
    zScale: number;
    colorTint: string;
};

export const DEFAULT_BAHAMUT_BLAST_CONFIG: BahamutBlastConfig = {
    speed: 1.0,
    complexity: 90.0,
    detail: 9.0,
    brightness: 4e6,
    zScale: 5.0,
    colorTint: '#ffffff'
};

type Props = {
    className?: string;
    config?: BahamutBlastConfig;
};

export const BahamutBlastEffect = memo(function BahamutBlastEffect({ 
    className, 
    config = DEFAULT_BAHAMUT_BLAST_CONFIG 
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                iResolution: { value: new THREE.Vector3(container.clientWidth, container.clientHeight, 1) },
                iTime: { value: 0 },
                iSpeed: { value: config.speed },
                iComplexity: { value: config.complexity },
                iDetail: { value: config.detail },
                iBrightness: { value: config.brightness },
                iZScale: { value: config.zScale },
                iColorTint: { value: new THREE.Color(config.colorTint) }
            },
            vertexShader,
            fragmentShader
        });

        const quad = new THREE.Mesh(geometry, material);
        scene.add(quad);

        const clock = new THREE.Clock();
        let rafId: number;

        const animate = () => {
            rafId = requestAnimationFrame(animate);
            material.uniforms.iTime.value = clock.getElapsedTime();
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!container) return;
            const width = container.clientWidth;
            const height = container.clientHeight;
            renderer.setSize(width, height);
            material.uniforms.iResolution.value.set(width, height, 1);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleResize);
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, [config]);

    return (
        <div className={`w-full h-full bg-black ${className ?? ''}`}>
            <div ref={containerRef} className="w-full h-full" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: bahamut_blast</div>
            </div>
        </div>
    );
});
