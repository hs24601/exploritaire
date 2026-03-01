import { memo, useEffect, useRef } from 'react';

type Props = {
  className?: string;
};

const NUM_POINTS = 100000;

const identity = (out: Float32Array) => {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
};

const perspective = (out: Float32Array, fovy: number, aspect: number, near: number, far: number) => {
  const f = 1.0 / Math.tan(fovy / 2);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = (2 * far * near) / (near - far);
  out[15] = 0;
};

const multiply = (out: Float32Array, a: Float32Array, b: Float32Array) => {
  const a00 = a[0]; const a01 = a[1]; const a02 = a[2]; const a03 = a[3];
  const a10 = a[4]; const a11 = a[5]; const a12 = a[6]; const a13 = a[7];
  const a20 = a[8]; const a21 = a[9]; const a22 = a[10]; const a23 = a[11];
  const a30 = a[12]; const a31 = a[13]; const a32 = a[14]; const a33 = a[15];
  const b00 = b[0]; const b01 = b[1]; const b02 = b[2]; const b03 = b[3];
  const b10 = b[4]; const b11 = b[5]; const b12 = b[6]; const b13 = b[7];
  const b20 = b[8]; const b21 = b[9]; const b22 = b[10]; const b23 = b[11];
  const b30 = b[12]; const b31 = b[13]; const b32 = b[14]; const b33 = b[15];
  out[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;
  out[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
  out[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
  out[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
  out[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;
};

const translate = (out: Float32Array, a: Float32Array, x: number, y: number, z: number) => {
  out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
  out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
  out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
  out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
  out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
  out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
  out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
};

const rotateX = (out: Float32Array, a: Float32Array, rad: number) => {
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  const a10 = a[4]; const a11 = a[5]; const a12 = a[6]; const a13 = a[7];
  const a20 = a[8]; const a21 = a[9]; const a22 = a[10]; const a23 = a[11];
  out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
};

const rotateY = (out: Float32Array, a: Float32Array, rad: number) => {
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  const a00 = a[0]; const a01 = a[1]; const a02 = a[2]; const a03 = a[3];
  const a20 = a[8]; const a21 = a[9]; const a22 = a[10]; const a23 = a[11];
  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
};

const rotateZ = (out: Float32Array, a: Float32Array, rad: number) => {
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  const a00 = a[0]; const a01 = a[1]; const a02 = a[2]; const a03 = a[3];
  const a10 = a[4]; const a11 = a[5]; const a12 = a[6]; const a13 = a[7];
  out[0] = a00 * c + a10 * s;
  out[1] = a01 * c + a11 * s;
  out[2] = a02 * c + a12 * s;
  out[3] = a03 * c + a13 * s;
  out[4] = a10 * c - a00 * s;
  out[5] = a11 * c - a01 * s;
  out[6] = a12 * c - a02 * s;
  out[7] = a13 * c - a03 * s;
  out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
  out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
};

export const LostInStarsAtmosphere = memo(function LostInStarsAtmosphere({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, `
precision mediump float;
uniform mat4 u_mvp;
attribute vec3 a_position;
varying float v_w;
void main(void) {
  vec4 finalPosition = u_mvp * vec4(a_position, 1.0);
  gl_Position = finalPosition;
  v_w = 1.0 / finalPosition.w;
  if (gl_Position.w > 0.0) {
    gl_PointSize = 4.0 / gl_Position.w;
  } else {
    gl_PointSize = 0.0;
  }
}`);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, `
precision highp float;
varying float v_w;
const vec4 begin = vec4(0.1, 0.75, 1.0, 1.0);
const vec4 end = vec4(1.0, 1.0, 1.0, 1.0);
vec4 interpolate4f(vec4 a,vec4 b, float p) {
  return p * b + (1.0 - p) * a;
}
void main(void) {
  vec2 pc = (gl_PointCoord - 0.5) * 2.0;
  float dist = (1.0 - sqrt(pc.x * pc.x + pc.y * pc.y));
  vec4 color = interpolate4f(begin, end, dist);
  gl_FragColor = vec4(dist, dist, dist, dist * dist * v_w) * color;
}`);

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    const positionAttr = gl.getAttribLocation(program, 'a_position');
    const mvpUniform = gl.getUniformLocation(program, 'u_mvp');
    if (positionAttr < 0 || !mvpUniform) return;

    const points = new Float32Array(NUM_POINTS * 3);
    for (let index = 0; index < NUM_POINTS; index += 1) {
      const i = index * 3;
      points[i] = (Math.random() - 0.5) * 8;
      points[i + 1] = (Math.random() - 0.5) * 8;
      points[i + 2] = (Math.random() - 0.5) * 8;
    }

    const buffer = gl.createBuffer();
    if (!buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttr);
    gl.vertexAttribPointer(positionAttr, 3, gl.FLOAT, false, 3 * 4, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const pMatrix = new Float32Array(16);
    const vMatrix = new Float32Array(16);
    const mvpMatrix = new Float32Array(16);
    perspective(pMatrix, Math.PI * 0.35, 1, 0.01, 1000.0);

    let angle = 0;
    let rafId = 0;
    let disposed = false;

    const resize = () => {
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      perspective(pMatrix, Math.PI * 0.35, canvas.width / canvas.height, 0.01, 1000.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    resize();

    const render = (now: number) => {
      if (disposed) return;
      resize();
      angle += 0.0005;
      const z = Math.sin(now / 50000);
      identity(vMatrix);
      translate(vMatrix, vMatrix, 0, 0, z);
      rotateX(vMatrix, vMatrix, angle);
      rotateY(vMatrix, vMatrix, angle);
      rotateZ(vMatrix, vMatrix, angle);
      multiply(mvpMatrix, pMatrix, vMatrix);
      gl.uniformMatrix4fv(mvpUniform, false, mvpMatrix);
      gl.drawArrays(gl.POINTS, 0, NUM_POINTS);
      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
});

