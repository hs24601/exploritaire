import { memo, useEffect, useRef } from 'react';

const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform vec2 mouse;
    uniform vec2 rippleCenter;
    uniform float rippleTime;
    
    vec2 fluidFlow(vec2 p, vec2 mousePos, float strength) {
        vec2 diff = mousePos - p;
        float dist = length(diff);
        float factor = exp(-dist * 1.5) * strength;
        return diff * factor;
    }
    
    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time * 0.5;
        vec2 m = (mouse * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        uv *= 1.5;
        
        vec3 finalColor = vec3(0.0);
        float totalIntensity = 0.0;
        
        float attractStrength = 0.6;
        vec2 flow = fluidFlow(uv, m, attractStrength);
        
        for(float i = 0.0; i < 4.0; i++) {
            vec2 p = uv;
            float id = i + 1.0;
            p += flow / (id * 0.25);
            p.x += sin(t * id * 0.4) * 0.8;
            p.y += cos(t * id * 0.3) * 0.8;
            
            float angle = atan(p.y, p.x) * 2.0;
            float dist = length(p) * 1.5;
            
            float pattern = sin(dist * 5.0 - t * 3.0 + angle * 2.0) +
                           cos(dist * 6.0 - t * 2.0 + angle * 3.0) +
                           sin(dist * 7.0 - t * 4.0 + angle);
            
            pattern = abs(pattern) / 3.0;
            pattern = pow(0.1 / (pattern + 0.1), 1.5);
            
            vec3 baseColor = vec3(1.0, 0.2, 0.3);
            if(i == 1.0) baseColor = vec3(0.2, 0.8, 1.0);
            if(i == 2.0) baseColor = vec3(1.0, 0.8, 0.2);
            if(i == 3.0) baseColor = vec3(0.8, 0.2, 1.0);
            
            vec3 color = baseColor * (0.6 + 0.4 * cos(vec3(0.0, 0.3, 0.6) * 6.28 + t + id));
            float highlight = exp(-dist * 2.0) * 1.8;
            
            finalColor += color * (pattern + highlight) * (1.2 / id);
            totalIntensity += pattern;
        }
        
        vec2 rc = (rippleCenter * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float d = length(uv - rc);
        float normalizedTime = clamp(rippleTime / 1.5, 0.0, 1.0);
        
        float rippleWave = sin(15.0 * (d - rippleTime * 2.2)) *
                          cos(10.0 * (d - rippleTime * 1.8)) *
                          exp(-d * 1.2) *
                          (1.0 - pow(normalizedTime, 1.5));
        
        vec3 rippleColor = vec3(0.8, 0.3, 1.0) + 
                          vec3(0.2, 0.5, 0.4) * cos(rippleTime * 4.0);
        finalColor += rippleColor * rippleWave * 0.7;
        
        finalColor /= (totalIntensity * 0.3 + 1.0);
        finalColor = pow(finalColor, vec3(0.7));
        finalColor *= 1.3;
        
        gl_FragColor = vec4(finalColor, 0.8); // Added transparency
    }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

export type TopoRainbowConfig = {
    noiseScale: number;
    veinScale: number;
    color1: string;
    color2: string;
    shieldSize: number;
    rotationSpeed: number;
};

export const DEFAULT_TOPO_RAINBOW_CONFIG: TopoRainbowConfig = {
    noiseScale: 1.5,
    veinScale: 2.0,
    color1: '#ffffff',
    color2: '#a0a0a0',
    shieldSize: 1.2,
    rotationSpeed: 0.005,
};

export const TopoRainbowEffect = memo(function TopoRainbowEffect({ 
    className, 
    config = DEFAULT_TOPO_RAINBOW_CONFIG 
}: { 
    className?: string, 
    config?: TopoRainbowConfig 
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const rippleRef = useRef({
        active: false,
        center: { x: 0, y: 0 },
        startTime: 0,
        duration: 1.8
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = canvas.getContext('webgl');
        if (!gl) return;

        const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        if (!vs || !fs) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

        gl.useProgram(program);

        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const resLoc = gl.getUniformLocation(program, 'resolution');
        const timeLoc = gl.getUniformLocation(program, 'time');
        const mouseLoc = gl.getUniformLocation(program, 'mouse');
        const ripCenterLoc = gl.getUniformLocation(program, 'rippleCenter');
        const ripTimeLoc = gl.getUniformLocation(program, 'rippleTime');

        let rafId: number;
        const render = (time: number) => {
            const t = time * 0.001;
            
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                gl.viewport(0, 0, w, h);
            }

            let currentRippleTime = 10.0;
            if (rippleRef.current.active) {
                currentRippleTime = t - rippleRef.current.startTime;
                if (currentRippleTime > rippleRef.current.duration) {
                    rippleRef.current.active = false;
                    currentRippleTime = 10.0;
                }
            }

            gl.uniform2f(resLoc, w, h);
            gl.uniform1f(timeLoc, t);
            gl.uniform2f(mouseLoc, mouseRef.current.x, mouseRef.current.y);
            gl.uniform2f(ripCenterLoc, rippleRef.current.center.x, rippleRef.current.center.y);
            gl.uniform1f(ripTimeLoc, currentRippleTime);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            rafId = requestAnimationFrame(render);
        };
        rafId = requestAnimationFrame(render);

        const onMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = {
                x: e.clientX - rect.left,
                y: rect.height - (e.clientY - rect.top)
            };
        };

        const onClick = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            rippleRef.current = {
                active: true,
                center: {
                    x: e.clientX - rect.left,
                    y: rect.height - (e.clientY - rect.top)
                },
                startTime: performance.now() * 0.001,
                duration: 1.8
            };
        };

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('click', onClick);

        return () => {
            cancelAnimationFrame(rafId);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('click', onClick);
            gl.deleteProgram(program);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            gl.deleteBuffer(buffer);
        };
    }, []);

    return (
        <div className={`w-full h-full bg-transparent flex items-center justify-center ${className ?? ''}`}>
            <div className="relative w-full h-full overflow-hidden rounded-lg">
                {/* Draw the bluey card behind the shader */}
                <img 
                    src="/assets/Bluevee.png" 
                    className="absolute inset-0 w-full h-full object-cover opacity-100" 
                    alt="Bluevee" 
                />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: topo_rainbow</div>
                </div>
            </div>
        </div>
    );
});
