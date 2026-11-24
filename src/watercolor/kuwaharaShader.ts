// Bounded classic four-region Kuwahara filter: 64 samples per painted pixel.
// It consumes a composited color image; geometry, normals and 3D models are not inputs.
export const paintVertexShader = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const paintFragmentShader = /* glsl */`
uniform sampler2D source;
uniform vec2 resolution;
uniform float brush;
uniform float strength;
uniform float time;
uniform float wash;
uniform float mode;
varying vec2 vUv;
void main() {
  vec3 original = texture2D(source, vUv).rgb;
  bool painted = mode > 0.5 && (mode > 1.5 || vUv.x > 0.5);
  vec3 result = original;
  if (painted && strength > 0.0) {
    vec2 drift = wash * 0.32 * vec2(sin(vUv.y * 73.0 + time * 0.6), cos(vUv.x * 67.0 - time * 0.5));
    vec2 center = vUv + drift / resolution;
    float bestVariance = 1.0e10;
    vec3 best = original;
    for (int region = 0; region < 4; region++) {
      vec2 direction = vec2(region < 2 ? -1.0 : 1.0, (region == 0 || region == 2) ? -1.0 : 1.0);
      vec3 mean = vec3(0.0), squared = vec3(0.0);
      for (int y = 0; y < 4; y++) {
        for (int x = 0; x < 4; x++) {
          vec2 offset = direction * vec2(float(x), float(y)) * brush / 3.0;
          vec3 color = texture2D(source, clamp(center + offset / resolution, vec2(0.0), vec2(1.0))).rgb;
          mean += color; squared += color * color;
        }
      }
      mean /= 16.0;
      vec3 variance = max(squared / 16.0 - mean * mean, vec3(0.0));
      float total = variance.r + variance.g + variance.b;
      if (total < bestVariance) { bestVariance = total; best = mean; }
    }
    result = mix(original, best, strength);
  }
  if (mode > 0.5 && mode < 1.5 && abs(vUv.x - 0.5) < 0.65 / resolution.x) result = vec3(0.93, 0.84, 0.65);
  gl_FragColor = vec4(result, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
