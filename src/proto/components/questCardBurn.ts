import html2canvas from 'html2canvas';
import * as THREE from 'three';

// Adapted from Ksenia Kondrashova's Burning HTML elements with WebGL:
// https://codepen.io/ksenia-k/pen/yLQLyZa
const fragmentShader = `
varying vec2 vUv;
uniform sampler2D u_texture;
uniform float u_progress;
uniform float u_size;
uniform float u_ratio;
float random(vec2 p) { return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  return mix(mix(random(i),random(i+vec2(1.,0.)),u.x),
    mix(random(i+vec2(0.,1.)),random(i+vec2(1.)),u.x),u.y);
}
float fbm(vec2 p) {
  float value=0., amplitude=.5;
  for(int i=0;i<4;i++){value+=amplitude*noise(p);p*=2.;amplitude*=.5;}
  return value;
}
void main() {
  vec4 base=texture2D(u_texture,vUv);
  vec2 uv=vec2(vUv.x,vUv.y/u_ratio);
  float t=pow(1.65*u_progress,.9);
  float edges=max(.4,pow(length(vUv-vec2(.5)),.5));
  float mask=fbm(.01*u_size*uv)/edges-.06*length(base.rgb);
  vec3 color=mix(base.rgb,vec3(0.),smoothstep(mask-.15,mask-.1,t));
  vec3 fire=fbm(6.*vUv+.1*t)*vec3(6.,1.4,0.);
  color=mix(color,fire,smoothstep(mask-.1,mask-.05,t));
  color-=.3*fbm(3.*vUv)*pow(t,4.);
  float alpha=base.a*(1.-smoothstep(mask-.01,mask,t));
  gl_FragColor=vec4(color,alpha);
}`;

/** Snapshot only the outgoing face. The caller owns timing, cancellation and pause. */
export async function createQuestCardBurn(face: HTMLElement, canvas: HTMLCanvasElement) {
  const rect = face.getBoundingClientRect();
  const snapshot = await html2canvas(face, {
    backgroundColor: null, scale: Math.min(devicePixelRatio || 1, 2),
    logging: false, useCORS: true, imageTimeout: 2000,
  });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  const texture = new THREE.CanvasTexture(snapshot);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: { u_texture: { value: texture }, u_progress: { value: 0 },
      u_size: { value: Math.max(rect.width, rect.height) }, u_ratio: { value: rect.width / rect.height } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.);}',
    fragmentShader, transparent: true, depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(rect.width, rect.height, false);
  renderer.setClearColor(0, 0);
  return {
    render(progress: number) { material.uniforms.u_progress.value = progress; renderer.render(scene, camera); },
    dispose() { geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
  };
}
