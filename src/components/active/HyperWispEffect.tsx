import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform float time;
    uniform vec2 resolution;
    uniform vec2 mouse;
    uniform vec2 clickPos;
    uniform float clickTime;

    varying vec2 vUv;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    float fbm(vec2 p, int octaves) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < octaves; ++i) {
            v += a * snoise(p);
            p = rot * p * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    vec3 hueShift(vec3 color, float hue) {
        const vec3 k = vec3(0.57735, 0.57735, 0.57735);
        float cosAngle = cos(hue);
        return color * cosAngle + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - cosAngle);
    }

    void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        float aspect = resolution.x / resolution.y;
        uv.x *= aspect;

        vec2 m = (mouse - 0.5) * 2.0;
        m.x *= aspect;

        vec2 cPos = (clickPos - 0.5) * 2.0;
        cPos.x *= aspect;

        float backgroundNoise = fbm(uv * 0.8 + time * 0.03, 4);
        float baseNoise = fbm(uv * 1.5 + time * 0.06, 6);

        float mouseDist = length(uv - m);
        float mouseInfluence = smoothstep(1.0, 0.0, mouseDist * 1.2);

        vec2 distortedUV = uv;

        float timeSinceClick = time - clickTime;
        float clickRippleIntensity = 0.0;
        vec2 clickDir = vec2(0.0);
        float clickDist = 0.0;

        const float RIPPLE_DURATION = 2.0;
        const float RIPPLE_SPEED = 1.8;
        const float RIPPLE_WIDTH = 0.2;

        if (clickTime > 0.0 && timeSinceClick > 0.0 && timeSinceClick < RIPPLE_DURATION) {
            clickDist = length(uv - cPos);
            clickDir = normalize(uv - cPos + 0.0001);
            float currentRadius = timeSinceClick * RIPPLE_SPEED;

            float rippleBand = smoothstep(currentRadius - RIPPLE_WIDTH, currentRadius, clickDist) -
                                smoothstep(currentRadius, currentRadius + RIPPLE_WIDTH, clickDist);

            float fade = smoothstep(RIPPLE_DURATION, RIPPLE_DURATION * 0.5, timeSinceClick);

            clickRippleIntensity = rippleBand * fade;
        }

        if (mouseInfluence > 0.01) {
            float angle = atan(uv.y - m.y, uv.x - m.x);
            float swirl = sin(angle * 8.0 + time * 2.5) * 0.3;
            vec2 mouseDir = normalize(uv - m);
            distortedUV += mouseDir * swirl * mouseInfluence;
            distortedUV += mouseDir * pow(mouseInfluence, 2.0) * 0.2;
        }

        if (clickRippleIntensity > 0.01) {
            vec2 shockwaveUV = uv * 2.5 + clickDir * timeSinceClick * 1.5;
            float shockwaveNoise = snoise(shockwaveUV);

            float distortionAmount = clickRippleIntensity * shockwaveNoise * 0.4;
            distortedUV += clickDir * distortionAmount;
        }

        float finalNoise = fbm(distortedUV * 2.0 + time * 0.1, 6);

        float pattern = mix(baseNoise, finalNoise, mouseInfluence * 0.8);

        float hue = sin(time * 0.05) * 0.1;
        vec3 color1 = hueShift(vec3(0.05, 0.0, 0.15), hue);
        vec3 color2 = hueShift(vec3(0.1, 0.3, 0.8), hue);
        vec3 color3 = hueShift(vec3(0.5, 0.1, 0.6), hue);
        vec3 color4 = hueShift(vec3(0.8, 0.5, 1.0), hue);

        vec3 baseColor = mix(color1, color2, smoothstep(-0.3, 0.3, backgroundNoise));
        baseColor = mix(baseColor, color3, smoothstep(-0.1, 0.4, pattern));

        if (mouseInfluence > 0.01) {
            float energyIntensity = pow(mouseInfluence, 1.5) * 1.5;
            float angle = atan(uv.y - m.y, uv.x - m.x);
            float pulse = pow(sin(angle * 10.0 - time * 4.0) * 0.5 + 0.5, 8.0);
            vec3 energyColor = mix(color2, color4, pulse);
            baseColor += energyColor * energyIntensity * 0.8;

            float core = smoothstep(0.15, 0.0, mouseDist);
            baseColor += vec3(1.0, 0.9, 1.0) * core * 0.5;
        }

        if (clickRippleIntensity > 0.01) {
             float shockwaveNoise = snoise(uv * 2.5 + clickDir * timeSinceClick * 1.5);
             vec3 shockwaveColor = mix(color3, color4, smoothstep(-0.5, 0.5, shockwaveNoise));
             baseColor += shockwaveColor * clickRippleIntensity * 1.2;
        }

        baseColor = clamp(baseColor, 0.0, 1.8);
        gl_FragColor = vec4(baseColor, 1.0);
    }
`;

export const HyperWispEffect = memo(function HyperWispEffect({ className }: { className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const targetMouse = useRef(new THREE.Vector2(0.5, 0.5));
    const currentMouse = useRef(new THREE.Vector2(0.5, 0.5));

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            0.6,
            0.5,
            0.8
        );
        composer.addPass(bloomPass);

        const geometry = new THREE.PlaneGeometry(2, 2);

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                time: { value: 0 },
                resolution: { value: new THREE.Vector2(width, height) },
                mouse: { value: new THREE.Vector2(0.5, 0.5) },
                clickPos: { value: new THREE.Vector2(0.5, 0.5) },
                clickTime: { value: -1.0 }
            },
            transparent: true
        });

        const plane = new THREE.Mesh(geometry, material);
        scene.add(plane);

        const updateMousePosition = (clientX: number, clientY: number) => {
            const rect = container.getBoundingClientRect();
            targetMouse.current.x = (clientX - rect.left) / rect.width;
            targetMouse.current.y = 1.0 - ((clientY - rect.top) / rect.height);
        };

        const triggerShockwave = (clientX: number, clientY: number) => {
            const rect = container.getBoundingClientRect();
            const clickX = (clientX - rect.left) / rect.width;
            const clickY = 1.0 - ((clientY - rect.top) / rect.height);
            material.uniforms.clickPos.value.set(clickX, clickY);
            material.uniforms.clickTime.value = material.uniforms.time.value;
        };

        const onMouseMove = (event: MouseEvent) => { updateMousePosition(event.clientX, event.clientY); };
        const onTouchMove = (event: TouchEvent) => {
            if (event.touches.length > 0) {
                updateMousePosition(event.touches[0].clientX, event.touches[0].clientY);
            }
        };
        const onTouchStart = (event: TouchEvent) => {
            if (event.touches.length > 0) {
                const touchX = event.touches[0].clientX;
                const touchY = event.touches[0].clientY;
                updateMousePosition(touchX, touchY);
                triggerShockwave(touchX, touchY);
            }
        };
        const onClick = (event: MouseEvent) => {
            triggerShockwave(event.clientX, event.clientY);
        };

        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('click', onClick);

        let rafId: number;
        const animate = (timestamp: number) => {
            rafId = requestAnimationFrame(animate);

            const lerpFactor = 0.08;
            currentMouse.current.x += (targetMouse.current.x - currentMouse.current.x) * lerpFactor;
            currentMouse.current.y += (targetMouse.current.y - currentMouse.current.y) * lerpFactor;

            material.uniforms.mouse.value.copy(currentMouse.current);
            material.uniforms.time.value = timestamp * 0.001;

            composer.render();
        };
        rafId = requestAnimationFrame(animate);

        const handleResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            renderer.setSize(w, h);
            composer.setSize(w, h);
            material.uniforms.resolution.value.set(w, h);
            bloomPass.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handleResize);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('click', onClick);
            
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    return (
        <div className={`w-full h-full bg-transparent flex items-center justify-center ${className ?? ''}`}>
            <div ref={containerRef} className="w-full h-full" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: hyper_wisp</div>
            </div>
        </div>
    );
});
