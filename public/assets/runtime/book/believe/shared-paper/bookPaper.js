import * as THREE from 'three';
import { DEFAULT_PAPER, linearRGB } from './vendor/watercolorPaperPresets.js';
import { paperFieldFragment, paperLightFragment, paperColourGLSL } from './vendor/watercolorPaperShaders.js';
export { PAPERS } from './vendor/watercolorPaperPresets.js';
const vertex = /* glsl */ `precision highp float;in vec3 position;in vec2 uv;out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const colorFragment = /* glsl */ `precision highp float;in vec2 vUv;out vec4 o;uniform sampler2D uPaper;
${paperColourGLSL}
void main(){o=vec4(paperColour(texture(uPaper,vUv),uPaperTint),1.);}`;
/** Upstream's height/mottle/fibre field and relief-lighting passes, followed by
 * a cached linear-color composite. No running simulation or GPU readback. */
export function createBookPaper(renderer, profile = DEFAULT_PAPER, height = 1024) {
    const width = Math.round(height * 5.8 / 7.5), geometry = new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene(), camera = new THREE.Camera();
    const make = (fragmentShader, uniforms) => new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vertex, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    const scale = 1100 / height;
    const field = make(paperFieldFragment, { uRes: { value: new THREE.Vector2(width, height) }, uOffset: { value: new THREE.Vector2() }, uScale: { value: scale }, uSeed: { value: 0 }, uKind: { value: profile.kind } });
    const light = make(paperLightFragment, { uField: { value: null }, uTexel: { value: new THREE.Vector2(1 / width, 1 / height) }, uBump: { value: profile.bump * 1.4 / scale } });
    const color = make(colorFragment, { uPaper: { value: null }, uPaperTint: { value: new THREE.Vector3(...linearRGB(profile.tint)) }, uFleckTint: { value: new THREE.Vector3(...linearRGB(profile.fleck)) }, uMottle: { value: profile.mottle }, uTexture: { value: 1 } });
    const quad = new THREE.Mesh(geometry, field);
    quad.frustumCulled = false;
    scene.add(quad);
    const previous = { target: renderer.getRenderTarget(), viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()), scissorTest: renderer.getScissorTest(), autoClear: renderer.autoClear };
    const temporary = new THREE.WebGLRenderTarget(width, height, { type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    const targets = [];
    function bake(seed) {
        field.uniforms.uSeed.value = seed;
        quad.material = field;
        renderer.setRenderTarget(temporary);
        renderer.render(scene, camera);
        const grain = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
        light.uniforms.uField.value = temporary.texture;
        quad.material = light;
        renderer.setRenderTarget(grain);
        renderer.render(scene, camera);
        const painted = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
        painted.texture.colorSpace = THREE.LinearSRGBColorSpace;
        painted.texture.anisotropy = Math.min(height <= 768 ? 2 : 4, renderer.capabilities.getMaxAnisotropy());
        color.uniforms.uPaper.value = grain.texture;
        quad.material = color;
        renderer.setRenderTarget(painted);
        renderer.render(scene, camera);
        targets.push(grain, painted);
        return { grain: grain.texture, color: painted.texture };
    }
    let left, right;
    try {
        renderer.autoClear = true;
        renderer.setScissorTest(false);
        left = bake(173.25);
        right = bake(291.75);
    }
    catch (error) {
        targets.forEach(t => t.dispose());
        throw error;
    }
    finally {
        renderer.setRenderTarget(previous.target);
        renderer.setViewport(previous.viewport);
        renderer.setScissor(previous.scissor);
        renderer.setScissorTest(previous.scissorTest);
        renderer.autoClear = previous.autoClear;
        temporary.dispose();
        geometry.dispose();
        field.dispose();
        light.dispose();
        color.dispose();
    }
    return { left: left.color, right: right.color, leftGrain: left.grain, rightGrain: right.grain, tint: profile.tint, profile: profile.id, dispose() { targets.forEach(t => t.dispose()); } };
}
