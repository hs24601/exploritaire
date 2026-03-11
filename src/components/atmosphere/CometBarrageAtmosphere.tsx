import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';

type Props = {
  className?: string;
};

const vertexShader = `
attribute vec3 position;
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform float time;

#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)

// Returns a pseudo random number for a given point (white noise)
float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}

// Returns a pseudo random number for a given point (value noise)
float noise(in vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  float
  a=rnd(i),
  b=rnd(i+vec2(1,0)),
  c=rnd(i+vec2(0,1)),
  d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}

// Returns a pseudo random number for a given point (fractal noise)
float fbm(vec2 p) {
  float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);
  for (int i=0; i<5; i++) {
    t+=a*noise(p);
    p*=2.*m;
    a*=.5;
  }
  return t;
}

float clouds(vec2 p) {
  float d=1., t=.0;
  for (float i=.0; i<3.; i++) {
    float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
    t=mix(t,d,a);
    d=a;
    p*=2./(i+1.);
  }
  return t;
}

void main(void) {
  vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.5,-st.y));
  uv*=1.-.3*(sin(T*.2)*.5+.5);
  for (float i=1.; i<12.; i++) {
    uv+=.1*cos(i*vec2(.1+.01*i, .8)+i*i+T*.5+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.00125/d*(cos(sin(i)*vec3(1,2,3))+1.);
    float b=noise(i+p+bg*1.731);
    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
    col=mix(col,vec3(bg*.25,bg*.137,bg*.05),d);
  }
  gl_FragColor=vec4(col,1);
}
`;

const PIXEL_ART_BOX_SHADOW = `
  45px 15px var(--b), 46px 15px var(--b), 47px 15px var(--a),
  10px 16px var(--a), 11px 16px var(--a), 12px 16px var(--b),
  13px 16px var(--b), 14px 16px var(--b), 15px 16px var(--b),
  16px 16px var(--b), 17px 16px var(--a), 35px 16px var(--a),
  36px 16px var(--a), 37px 16px var(--b), 38px 16px var(--b),
  39px 16px var(--b), 40px 16px var(--b), 41px 16px var(--b),
  42px 16px var(--b), 43px 16px var(--b), 44px 16px var(--b),
  45px 16px var(--b), 46px 16px var(--b), 47px 16px var(--a),
  9px 17px var(--a), 10px 17px var(--b), 11px 17px var(--b),
  12px 17px var(--b), 13px 17px var(--b), 14px 17px var(--b),
  15px 17px var(--b), 16px 17px var(--b), 17px 17px var(--a),
  37px 17px var(--a), 38px 17px var(--a), 39px 17px var(--b),
  40px 17px var(--b), 41px 17px var(--b), 42px 17px var(--b),
  43px 17px var(--b), 44px 17px var(--b), 45px 17px var(--b),
  46px 17px var(--b), 47px 17px var(--b), 48px 17px var(--a),
  49px 17px var(--a), 51px 17px var(--a), 7px 18px var(--a),
  8px 18px var(--a), 9px 18px var(--a), 10px 18px var(--b),
  11px 18px var(--b), 12px 18px var(--b), 13px 18px var(--b),
  14px 18px var(--b), 15px 18px var(--b), 16px 18px var(--b),
  17px 18px var(--a), 20px 18px var(--a), 37px 18px var(--a)
`;

export const CometBarrageAtmosphere = memo(function CometBarrageAtmosphere({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = rootRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const uniforms = {
      resolution: { value: new THREE.Vector2() },
      time: { value: 0 },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let rafId = 0;
    let disposed = false;

    const resize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      uniforms.resolution.value.set(width, height);
    };

    const animate = (timestamp: number) => {
      if (disposed) return;
      uniforms.time.value = timestamp / 1000;
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    resize();
    rafId = requestAnimationFrame(animate);
    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={rootRef} className={`w-full h-full relative overflow-hidden ${className}`}>
      <style>{`
        @keyframes comet-drift {
          0% { transform: translate(-100px, -100px) rotate(45deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translate(calc(100vw + 100px), calc(100vh + 100px)) rotate(45deg); opacity: 0; }
        }
        .pixel-comet {
          position: absolute;
          width: 2px;
          height: 2px;
          --a: #ffffff;
          --b: #7fdbca;
          box-shadow: ${PIXEL_ART_BOX_SHADOW};
          pointer-events: none;
          z-index: 10;
        }
      `}</style>
      <div 
        className="pixel-comet" 
        style={{ 
          top: '10%', 
          left: '10%', 
          animation: 'comet-drift 5s linear infinite',
          filter: 'drop-shadow(0 0 10px #7fdbca)'
        }} 
      />
      <div 
        className="pixel-comet" 
        style={{ 
          top: '30%', 
          left: '-5%', 
          animation: 'comet-drift 7s linear infinite 2s',
          filter: 'drop-shadow(0 0 10px #7fdbca)',
          transform: 'scale(0.8)'
        }} 
      />
    </div>
  );
});

