import { memo, useEffect, useRef } from 'react';

export type BurnEdgesConfig = {
  progress: number;
  burnColor: string;
  burnWidth: number;
  noiseScale: number;
  cardImageUrl?: string;
  aspectRatio: number;
};

export const DEFAULT_BURN_EDGES_CONFIG: BurnEdgesConfig = {
  progress: 0,
  burnColor: '#ff6b35',
  burnWidth: 0.05,
  noiseScale: 0.75,
  cardImageUrl: '/assets/Bluevee.png',
  aspectRatio: 2.2 / 3,
};

type Props = {
  className?: string;
  config?: BurnEdgesConfig;
};

export const BurnEdgesEffect = memo(function BurnEdgesEffect({ 
  className,
  config = DEFAULT_BURN_EDGES_CONFIG 
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // WebGL Resource Refs to prevent flickering/re-creation
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastImageUrl = useRef<string | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;
    glRef.current = gl;

    const vsSource = `
      precision mediump float;
      attribute vec2 a_position;
      varying vec2 vUv;
      void main() {
        vUv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform vec2 u_resolution;
      uniform float u_progress;
      uniform float u_time;
      uniform sampler2D u_cardTexture;
      uniform float u_noiseScale;
      uniform vec3 u_burnColor;

      float rand(vec2 n) {
        return fract(cos(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
      }

      float noise(vec2 n) {
        const vec2 d = vec2(0., 1.);
        vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
        return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
      }

      float fbm(vec2 n) {
        float total = 0.0, amplitude = .4;
        for (int i = 0; i < 4; i++) {
          total += noise(n) * amplitude;
          n += n;
          amplitude *= 0.6;
        }
        return total;
      }

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        float screenAspect = u_resolution.x / u_resolution.y;
        uv.x *= screenAspect;
        
        vec2 noiseUv = uv * u_noiseScale;
        float t = u_progress;
        
        vec4 cardColor = texture2D(u_cardTexture, vUv);
        vec3 color = cardColor.rgb;

        float main_noise = 1. - fbm(0.75 * noiseUv + 10. - vec2(0.3, 0.9 * t));

        float paper_darkness = smoothstep(main_noise - 0.1, main_noise, t);
        color -= vec3(0.6) * paper_darkness; 

        vec3 fire_base_color = u_burnColor;
        vec3 fire_glow = fbm(6. * noiseUv - vec2(0., 0.005 * u_time)) * fire_base_color * 3.0;
        
        float show_fire = smoothstep(0.4, 0.9, fbm(10. * noiseUv + 2. - vec2(0., 0.005 * u_time)));
        show_fire += smoothstep(0.7, 0.8, fbm(0.5 * noiseUv + 5. - vec2(0., 0.001 * u_time)));

        float fire_border = 0.04 * show_fire;
        float fire_edge = smoothstep(main_noise - fire_border, main_noise - 0.5 * fire_border, t);
        fire_edge *= (1. - smoothstep(main_noise - 0.5 * fire_border, main_noise, t));
        
        color += fire_glow * fire_edge;

        float opacity = cardColor.a * (1. - smoothstep(main_noise - 0.0005, main_noise, t));
        gl_FragColor = vec4(color, opacity);
      }
    `;

    const createShader = (gl: WebGLRenderingContext, source: string, type: number) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl, vsSource, gl.VERTEX_SHADER));
    gl.attachShader(program, createShader(gl, fsSource, gl.FRAGMENT_SHADER));
    gl.linkProgram(program);
    programRef.current = program;

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    textureRef.current = texture;
  }, []);

  // Update loop
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    let rafId: number;

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uProgress = gl.getUniformLocation(program, 'u_progress');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uNoiseScale = gl.getUniformLocation(program, 'u_noiseScale');
    const uBurnColor = gl.getUniformLocation(program, 'u_burnColor');
    const uCardTexture = gl.getUniformLocation(program, 'u_cardTexture');

    // Handle Image Loading
    if (config.cardImageUrl !== lastImageUrl.current) {
      lastImageUrl.current = config.cardImageUrl;
      const image = new Image();
      image.src = config.cardImageUrl || '/assets/Bluevee.png';
      image.onload = () => {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        imageRef.current = image;
      };
    }

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return [r, g, b];
    };

    const render = (time: number) => {
      if (!containerRef.current || !canvasRef.current) return;
      
      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;
      
      if (canvasRef.current.width !== width || canvasRef.current.height !== height) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uProgress, config.progress);
      gl.uniform1f(uTime, time * 0.001);
      gl.uniform1f(uNoiseScale, config.noiseScale);
      const rgb = hexToRgb(config.burnColor);
      gl.uniform3f(uBurnColor, rgb[0], rgb[1], rgb[2]);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
      gl.uniform1i(uCardTexture, 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [config.progress, config.burnColor, config.noiseScale, config.cardImageUrl]);

  return (
    <div ref={containerRef} className={`w-full h-full bg-black/20 flex items-center justify-center p-10 ${className ?? ''}`}>
      <div 
        className="relative shadow-2xl overflow-hidden rounded-lg bg-black/10"
        style={{ 
          width: 'min(70%, 400px)', 
          aspectRatio: `${config.aspectRatio}` 
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-10">Active Effect: burn_edges</div>
        </div>
      </div>
    </div>
  );
});
