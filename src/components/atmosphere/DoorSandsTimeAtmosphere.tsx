import { memo, useEffect, useRef } from 'react';

export type DoorSandsTimeConfig = {
  speed: number;
};

export const DEFAULT_DOOR_SANDS_TIME_CONFIG: DoorSandsTimeConfig = {
  speed: 0.1,
};

type Props = {
  className?: string;
  config?: DoorSandsTimeConfig;
};

export const DoorSandsTimeAtmosphere = memo(function DoorSandsTimeAtmosphere({ 
  className, 
  config = DEFAULT_DOOR_SANDS_TIME_CONFIG 
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vert = `
      attribute vec2 pos;
      void main() {
        gl_Position = vec4(pos, 0.0, 1.0);
      }
    `;

    const frag = `
      precision highp float;
      uniform vec2 u_res;
      uniform float u_time;
      uniform float u_speed;

      void main() {
        vec2 FC = gl_FragCoord.xy;
        float t = u_time * u_speed;
        vec2 r = u_res;
        vec2 p = (FC * 2.0 - r) / r.y;

        vec3 c = vec3(0.0);

        for (float i = 0.0; i < 42.0; i++) {
          float a = i / 1.5 + t * 0.5;
          vec2 q = p;
          q.x = q.x + sin(q.y * 19.0 + t * 2.0 + i) * 29.0 * smoothstep(0.0, -2.0, q.y);
          float d = length(q - vec2(cos(a), sin(a)) * (0.4 * smoothstep(0.0, 0.5, -q.y)));
          c = c + vec3(0.34, 0.30, 0.24) * (0.015 / d);
        }

        vec3 col = c * c + 0.05;
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    function compile(src: string, type: number) {
      const s = gl!.createShader(type);
      if (!s) throw new Error('Could not create shader');
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        const msg = gl!.getShaderInfoLog(s);
        throw new Error(msg || 'Shader compile error');
      }
      return s;
    }

    const vs = compile(vert, gl.VERTEX_SHADER);
    const fs = compile(frag, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'pos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
    }

    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_res');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uSpeed = gl.getUniformLocation(program, 'u_speed');

    let rafId: number;
    const startTime = performance.now();

    const render = () => {
      const now = performance.now();
      const t = (now - startTime) * 0.001;

      const d = window.devicePixelRatio || 1;
      const w = canvas.clientWidth * d;
      const h = canvas.clientHeight * d;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uSpeed, config.speed);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(rafId);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [config]);

  return <canvas ref={canvasRef} className={`w-full h-full block bg-black ${className ?? ''}`} />;
});
