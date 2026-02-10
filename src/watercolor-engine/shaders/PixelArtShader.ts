/**
 * Pixel Art Shader - Creates blocky pixel effect by sampling at lower resolution
 * Mimics classic pixel art appearance with blocky unicode rendering
 */

export const pixelArtVertexShader = `
precision highp float;

attribute vec2 aVertexPosition;
attribute vec2 aUvs;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;

varying vec2 vTextureCoord;

void main(void){
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
  vTextureCoord = aUvs;
}
`;

export const pixelArtFragmentShader = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float pixelSize;

void main(void) {
  // Quantize texture coordinates to pixel grid
  vec2 pixelated = floor(vTextureCoord / pixelSize) * pixelSize;

  // Sample from the pixelated coordinate
  gl_FragColor = texture2D(uSampler, pixelated);
}
`;

/**
 * Create a pixel art filter with configurable pixel size
 * @param pixelSize Size of each pixel block (default 4.0)
 * @returns Configured Filter ready for use
 */
export function createPixelArtFilter(pixelSize: number = 4.0) {
  const { Filter } = require('pixi.js');

  const filter = new Filter(pixelArtVertexShader, pixelArtFragmentShader, {
    pixelSize: pixelSize / Math.max(1, window.devicePixelRatio || 1),
  });

  return filter;
}
