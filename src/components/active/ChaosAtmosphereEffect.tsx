import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision highp float;
    #define PI 3.14159

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    uniform vec3 u_color3;
    uniform vec3 u_color4;
    uniform vec3 u_color5;
    uniform float u_timeScale;
    uniform float u_scale;
    uniform float u_opacity;

    //Simplex 3D Noise 
    //by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

    float snoise(vec3 v){ 
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

      // First corner
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 =   v - i + dot(i, C.xxx) ;

      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );

      //  x0 = x0 - 0. + 0.0 * C 
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1. + 3.0 * C.xxx;

      // Permutations
      i = mod(i, 289.0 ); 
      vec4 p = permute( permute( permute( 
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

      // Gradients
      // ( N*N points uniformly over a square, mapped onto an octahedron.)
      float n_ = 1.0/7.0; // N=7
      vec3  ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

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

      //Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    const int OCTAVES = 6;
    const float PERSISTANCE = 0.5;

    float ease(float x) {
      return 1.0 - cos((x * PI) / 1.7);
    }

    float sumOctaveNoise(
        vec3 position,
        float persistence, 
        float scale
      ) {
      float maxAmp = 0.0;
      float amp = 1.0;
      float freq = scale;
      float noise = 0.0;

      for(int i = 0; i < OCTAVES; i++) {
        noise += snoise(position * freq) * amp;
        maxAmp += amp;
        amp *= persistence;
        freq *= 2.0;
      }

      return noise / maxAmp ;
    }

    void main() {
      vec2 pos = gl_FragCoord.xy / u_resolution.x;
      vec3 noisePos = vec3(pos.x, pos.y, u_time * u_timeScale);
      float val = sumOctaveNoise(noisePos, PERSISTANCE, u_scale) * 0.5 + 0.5;

      val = ease(val);

      float step = 1.0 / 5.0;

      vec3 color = mix(u_color1, u_color2, smoothstep(0.0, step, val));
      color = mix(color, u_color3, smoothstep(step, step * 2.0, val));
      color = mix(color, u_color4, smoothstep(step * 2.0, step * 3.0, val));
      color = mix(color, u_color5, smoothstep(step * 3.0, step * 4.0, val));

      gl_FragColor = vec4(vec3(color), u_opacity);
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

export type ChaosAtmosphereConfig = {
    scale: number;
    timeScale: number;
    color1: string;
    color2: string;
    color3: string;
    color4: string;
    color5: string;
    opacity?: number;
};

export const DEFAULT_CHAOS_ATMOSPHERE_CONFIG: ChaosAtmosphereConfig = {
    scale: 4.0,
    timeScale: 0.01,
    color1: '#6805f2',
    color2: '#2405f2',
    color3: '#21038c',
    color4: '#150259',
    color5: '#bf05f2',
    opacity: 0.8,
};

export const ChaosAtmosphereEffect = memo(function ChaosAtmosphereEffect({ 
    className,
    config = DEFAULT_CHAOS_ATMOSPHERE_CONFIG,
    showLabel = true,
    quality = 'full',
}: { 
    className?: string,
    config?: ChaosAtmosphereConfig,
    showLabel?: boolean,
    quality?: 'full' | 'moving',
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: quality === 'full',
            powerPreference: 'high-performance',
        });
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

        const resLoc = gl.getUniformLocation(program, 'u_resolution');
        const timeLoc = gl.getUniformLocation(program, 'u_time');
        const color1Loc = gl.getUniformLocation(program, 'u_color1');
        const color2Loc = gl.getUniformLocation(program, 'u_color2');
        const color3Loc = gl.getUniformLocation(program, 'u_color3');
        const color4Loc = gl.getUniformLocation(program, 'u_color4');
        const color5Loc = gl.getUniformLocation(program, 'u_color5');
        const timeScaleLoc = gl.getUniformLocation(program, 'u_timeScale');
        const scaleLoc = gl.getUniformLocation(program, 'u_scale');
        const opacityLoc = gl.getUniformLocation(program, 'u_opacity');

        const c1 = new THREE.Color(config.color1);
        const c2 = new THREE.Color(config.color2);
        const c3 = new THREE.Color(config.color3);
        const c4 = new THREE.Color(config.color4);
        const c5 = new THREE.Color(config.color5);

        let rafId: number;
        let lastRenderTime = 0;
        const resolutionScale = quality === 'moving' ? 0.5 : 1;
        const minFrameTime = quality === 'moving' ? 1000 / 24 : 0;
        const render = (time: number) => {
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            const scaledW = Math.max(1, Math.round(w * resolutionScale));
            const scaledH = Math.max(1, Math.round(h * resolutionScale));
            if (canvas.width !== scaledW || canvas.height !== scaledH) {
                canvas.width = scaledW;
                canvas.height = scaledH;
                gl.viewport(0, 0, scaledW, scaledH);
            }

            if (minFrameTime > 0 && time - lastRenderTime < minFrameTime) {
                rafId = requestAnimationFrame(render);
                return;
            }
            lastRenderTime = time;

            gl.uniform2f(resLoc, w, h);
            gl.uniform1f(timeLoc, time * 0.05);
            gl.uniform3f(color1Loc, c1.r, c1.g, c1.b);
            gl.uniform3f(color2Loc, c2.r, c2.g, c2.b);
            gl.uniform3f(color3Loc, c3.r, c3.g, c3.b);
            gl.uniform3f(color4Loc, c4.r, c4.g, c4.b);
            gl.uniform3f(color5Loc, c5.r, c5.g, c5.b);
            gl.uniform1f(timeScaleLoc, config.timeScale);
            gl.uniform1f(scaleLoc, config.scale);
            gl.uniform1f(opacityLoc, config.opacity ?? 0.8);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            rafId = requestAnimationFrame(render);
        };
        rafId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(rafId);
            gl.deleteProgram(program);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            gl.deleteBuffer(buffer);
        };
    }, [config, quality]);

    return (
        <div className={`w-full h-full bg-transparent flex items-center justify-center ${className ?? ''}`}>
            <div className="relative w-full h-full overflow-hidden rounded-lg">
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                {showLabel && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: chaos_atmosphere</div>
                  </div>
                )}
            </div>
        </div>
    );
});
