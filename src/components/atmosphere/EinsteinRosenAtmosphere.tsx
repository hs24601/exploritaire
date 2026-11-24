import { memo, useEffect, useRef } from 'react';

type Props = {
  className?: string;
};

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
in vec4 position;
void main() {
  gl_Position = position;
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
#define FC gl_FragCoord.xy
#define R resolution
#define T time
#define hue(a) (.6+.6*cos(6.3*(a)+vec3(0,83,21)))

float rnd(float a) {
  vec2 p = fract(a * vec2(12.9898, 78.233));
  p += dot(p, p * 345.);
  return fract(p.x * p.y);
}

vec3 pattern(vec2 uv) {
  vec3 col = vec3(0);
  for (float i = .0; i++ < 20.;) {
    float a = rnd(i);
    vec2 n = vec2(a, fract(a * 34.56));
    vec2 p = sin(n * (T + 7.) + T * .5);
    float d = dot(uv - p, uv - p);
    col += .00125 / d * hue(dot(uv, uv) + i * .125 + T);
  }
  return col;
}

void main(void) {
  vec2 uv = (FC - .5 * R) / min(R.x, R.y);
  vec3 col = vec3(0);

  float s = 2.4;
  float a = atan(uv.x, uv.y);
  float b = length(uv);

  uv = vec2(a * 5. / 6.28318, .05 / tan(b) + T);
  uv = fract(uv) - .5;
  col += pattern(uv * s);
  O = vec4(col, 1.);
}
`;

export const EinsteinRosenAtmosphere = memo(function EinsteinRosenAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.userSelect = 'none';
    mount.appendChild(canvas);

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
    if (!gl) {
      return () => {
        if (mount.contains(canvas)) mount.removeChild(canvas);
      };
    }

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        console.error('EinsteinRosen shader compile error:', info);
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vertexShader || !fragmentShader) {
      return () => {
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        if (mount.contains(canvas)) mount.removeChild(canvas);
      };
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return () => {
        if (mount.contains(canvas)) mount.removeChild(canvas);
      };
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('EinsteinRosen program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return () => {
        if (mount.contains(canvas)) mount.removeChild(canvas);
      };
    }

    const vertices = new Float32Array([
      -1, 1,
      -1, -1,
      1, 1,
      1, -1,
    ]);
    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return () => {
        if (mount.contains(canvas)) mount.removeChild(canvas);
      };
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'position');
    const resolutionUniform = gl.getUniformLocation(program, 'resolution');
    const timeUniform = gl.getUniformLocation(program, 'time');

    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    let raf = 0;
    let disposed = false;

    const resize = () => {
      const dpr = Math.max(1, 0.5 * (window.devicePixelRatio || 1));
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const render = (now: number) => {
      if (disposed) return;
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
      gl.uniform1f(timeUniform, now * 0.001);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (mount.contains(canvas)) mount.removeChild(canvas);
    };
  }, []);

  return <div ref={rootRef} className={`w-full h-full ${className ?? ''}`} />;
});
