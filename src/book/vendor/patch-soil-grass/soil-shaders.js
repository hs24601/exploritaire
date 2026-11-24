// The soil, moss and crack shaders of Soil Studio, by mohamedachrefelouafi (MIT, © 2026 mohamedachrefelouafi,
// ./LICENSE), from https://github.com/achrefelouafi/GrassSystemThreeJS at b236b2a, src/main.js: NOISE_FUNCTIONS,
// HEIGHT_FUNCTIONS, SOIL_SHADE_FUNCTIONS and the soil material's onBeforeCompile, as they are there, wrapped in a
// function so any MeshStandardMaterial can take them.
//
// Patch's changes are marked "Patch:". There are four:
// - The plot's size is a uniform (uPlotHalf) instead of the hard-coded 10 m half-size; the mounds and moss still
//   taper to flat over its last 2 m.
// - A painted field (uField, R = wetness, G = growth) that a game writes: growth scales where moss (and, in
//   grass.js, grass) may grow, and wetness darkens and glosses the soil like the damp patches. A field of all
//   growth and no wetness is upstream's look exactly.
// - uMoundMid: how much of the mounds' height sits at ground level, so a tall setting makes hollows as well as
//   mounds rather than lifting the whole middle of the plot above its rim. 0 is upstream's.
// - The relief normal is skipped when uReliefShading is 0, and the crack grooves when the cracks are off, so
//   slow GPUs don't pay for them.

// Pure noise helpers (no uniforms).
export const NOISE_FUNCTIONS = /* glsl */ `
// --- Ashima 2D simplex noise -------------------------------------------------
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal Brownian motion for organic, blotchy shapes.
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amp * snoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return value;
}

// --- Cellular (Worley) noise -------------------------------------------------
// Returns the two nearest feature-point distances (F1, F2). The BORDER between
// two cells sits where F2-F1 -> 0, which traces the polygonal plate network of
// cracked, sun-baked soil.
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}
vec2 worleyF1F2(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);           // jittered feature point in the cell
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}
`;

// Terrain height field — SHARED by the soil material AND the grass (so blades
// sit exactly on the displaced ground, live, as the mound sliders move). Only
// the shaping uniforms it needs are declared here.
export const HEIGHT_FUNCTIONS = /* glsl */ `
uniform float uMoundScale;
uniform vec2  uSeed;
uniform float uMoundDepth;
uniform float uMoundCoverage;
uniform float uMoundEdge;
uniform float uBumpScale;
uniform float uBumpStrength;

// --- Moss height field (same "settled" principle as the snow accumulation) ---
uniform float uMossEnabled;
uniform float uMossScale;
uniform vec2  uMossSeed;
uniform float uMossCoverage;
uniform float uMossEdge;
uniform float uMossDepth;
uniform float uMossBumpScale;
uniform float uMossBumpStrength;

// Patch: the plot's half-size (upstream: 10) and the field a game paints, R = wetness, G = growth, over
// uFieldHalf around uFieldCenter. Outside it the ground is dry and fully grown.
uniform float uPlotHalf;
uniform float uMoundMid;
uniform sampler2D uField;
uniform vec2  uFieldCenter;
uniform float uFieldHalf;
vec2 fieldAt(vec2 xz) {
  vec2 uv = (xz - uFieldCenter) / (2.0 * uFieldHalf) + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec2(0.0, 1.0);
  return texture2D(uField, uv).rg;
}

// Where moss has grown: a world-space FBM mask, 0 (bare soil) .. 1 (deep moss).
// coverage 0 -> nothing, 1 -> everywhere (soft, randomizable patches).
float mossMaskAt(vec2 worldXZ) {
  if (uMossEnabled < 0.5) return 0.0;                       // master switch (off)
  vec2 p = worldXZ * uMossScale + uMossSeed;
  float n = fbm(p) * 0.5 + 0.5;                            // 0..1
  float cov = uMossCoverage * fieldAt(worldXZ).y;           // Patch: only on grown ground
  float threshold = mix(1.0 + uMossEdge, -uMossEdge, cov);
  return smoothstep(threshold - uMossEdge, threshold + uMossEdge, n);
}

// Thickness of the moss carpet above the soil, in world units. A base layer
// scaled by the coverage mask plus lumpy drift detail — the same single source
// of truth the snow used: the vertex stage lifts the geometry by it and the
// fragment stage differentiates it for shading, so silhouette and lighting agree.
float mossHeightAt(vec2 worldXZ) {
  float mask = mossMaskAt(worldXZ);
  float drift = fbm(worldXZ * uMossBumpScale + 31.7) * 0.5 + 0.5; // 0..1 lumps
  float h = mask * (1.0 - 0.4 * uMossBumpStrength + 0.4 * uMossBumpStrength * drift);
  vec2 edge = smoothstep(uPlotHalf, uPlotHalf - 2.0, abs(worldXZ)); // taper at the rim (Patch: uPlotHalf)
  return uMossDepth * h * edge.x * edge.y;
}

// Height of the soil surface above the flat plane, in world units. Broad mounds
// modulated by finer lumps. A coverage mask (driven by the same noise) flattens
// the low ground first, so lowering coverage leaves only the tallest peaks.
// Tapered to zero near the plane rim (half-extent 10) so the raised layer never
// leaves a floating cliff at the border. The moss carpet is laid on top so the
// ground (and any grass snapped to it) rises through the moss.
float groundHeightAt(vec2 worldXZ) {
  vec2 p = worldXZ * uMoundScale + uSeed;
  float base  = fbm(p) * 0.5 + 0.5;                       // 0..1 broad mounds
  float drift = fbm(worldXZ * uBumpScale + uSeed * 0.5) * 0.5 + 0.5;
  float h = base * (1.0 - 0.4 * uBumpStrength + 0.4 * uBumpStrength * drift);
  float mThresh = mix(1.0 + uMoundEdge, -uMoundEdge, uMoundCoverage);
  h *= smoothstep(mThresh - uMoundEdge, mThresh + uMoundEdge, base);
  vec2 edge = smoothstep(uPlotHalf, uPlotHalf - 2.0, abs(worldXZ)); // Patch: uPlotHalf
  return uMoundDepth * (h - uMoundMid) * edge.x * edge.y + mossHeightAt(worldXZ); // Patch: uMoundMid
}
`;

// Soil-only shading uniforms + the normal-shading helper (fragment stage).
export const SOIL_SHADE_FUNCTIONS = /* glsl */ `
uniform vec3  uSoilColor;
uniform float uVarScale;
uniform float uVarAmount;
uniform float uVarCoverage;
uniform float uVarEdge;
uniform vec2  uVarSeed;
uniform float uMoisture;
uniform float uMoistScale;
uniform float uMoistEdge;
uniform vec2  uMoistSeed;
uniform float uWetDarken;
uniform float uWetRoughness;
uniform float uCrackEnabled;
uniform float uCrackAmount;
uniform float uCrackScale;
uniform float uCrackWidth;
uniform float uCrackWarp;
uniform float uCrackDepth;
uniform vec2  uCrackSeed;
uniform float uReliefShading;
uniform float uTime;

// Dry-soil crack network intensity (0 = intact plate .. 1 = deep channel). A
// warped cellular (Worley) field carves irregular polygonal plates separated by
// recessed fissures, with a finer second layer subdividing the big plates — the
// look of cracked, baked earth rather than the thin veins of a frozen lake.
float soilCrackAt(vec2 xz) {
  if (uCrackEnabled < 0.5) return 0.0;                      // master switch (off)
  vec2 warp = vec2(fbm(xz * uCrackScale * 0.5 + uCrackSeed + 3.1),
                   fbm(xz * uCrackScale * 0.5 + uCrackSeed + 7.7)) * uCrackWarp;
  vec2 cp = xz * uCrackScale + uCrackSeed + warp;
  float w = max(uCrackWidth, 0.001);
  vec2 f = worleyF1F2(cp);
  float primary = 1.0 - smoothstep(0.0, w, f.y - f.x);
  vec2 f2 = worleyF1F2(cp * 2.7 + 13.0);
  float secondary = (1.0 - smoothstep(0.0, w * 1.6, f2.y - f2.x)) * 0.5;
  return clamp(max(primary, secondary), 0.0, 1.0);
}

// Moss shading (albedo/roughness/normal/AO textures + look controls).
uniform sampler2D uMossMap;
uniform sampler2D uMossRoughnessMap;
uniform sampler2D uMossNormalMap;
uniform sampler2D uMossAoMap;
uniform vec3  uMossColor;
uniform float uMossRoughness;
uniform float uMossTextureScale;
uniform float uMossNormalScale;
uniform float uMossAoStrength;

// Analytic surface normal of the displaced ground (for shading the slopes).
vec3 groundSurfaceNormal(vec2 worldXZ) {
  float e = 0.08;
  float h0 = groundHeightAt(worldXZ);
  float hx = groundHeightAt(worldXZ + vec2(e, 0.0));
  float hz = groundHeightAt(worldXZ + vec2(0.0, e));
  vec2 grad = vec2(hx - h0, hz - h0) / e;
  return normalize(vec3(-grad.x, 1.0, -grad.y));
}
`;

export const SOIL_INJECT = NOISE_FUNCTIONS + HEIGHT_FUNCTIONS + SOIL_SHADE_FUNCTIONS;

/**
 * Upstream's soil material patch (main.js, `material.onBeforeCompile`), for any MeshStandardMaterial with the
 * soil's map, aoMap, roughnessMap and normalMap. The uniforms objects are shared by reference, so changing a
 * value changes every material and the grass at once, with no recompile.
 */
export function patchSoilMaterial(material, soilUniforms, mossUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, soilUniforms, mossUniforms);

    // Vertex: inject the field, then raise the ground geometry by it.
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWorldPosition;\n' + SOIL_INJECT
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec2 groundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
        transformed += normalize(objectNormal) * groundHeightAt(groundXZ);
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWorldPosition;\n' + SOIL_INJECT
      )
      // Albedo: large-scale tone variation, overall tint, wet patches and cracks.
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 sXZ = vWorldPosition.xz;

        // Broad dry/rich tone variation, confined to a randomizable coverage mask
        // (coverage 0 -> flat base, 1 -> variation everywhere).
        float tone = fbm(sXZ * uVarScale + uVarSeed) * 0.5 + 0.5;
        float tMaskN = fbm(sXZ * uVarScale * 0.7 + uVarSeed + 17.0) * 0.5 + 0.5;
        float tThresh = mix(1.0 + uVarEdge, -uVarEdge, uVarCoverage);
        float tMask = smoothstep(tThresh - uVarEdge, tThresh + uVarEdge, tMaskN);
        diffuseColor.rgb *= mix(1.0, mix(1.0 - uVarAmount, 1.0 + uVarAmount, tone), tMask);
        diffuseColor.rgb *= uSoilColor;

        // Moisture: damp patches darken the soil (used again in the rough stage).
        // Coverage maps 0 -> dry everywhere, 1 -> damp everywhere (full coverage).
        float wn  = fbm(sXZ * uMoistScale + uMoistSeed) * 0.5 + 0.5;
        float wThresh = mix(1.0 + uMoistEdge, -uMoistEdge, uMoisture);
        float wet = smoothstep(wThresh - uMoistEdge, wThresh + uMoistEdge, wn);
        wet = max(wet, smoothstep(0.02, 0.6, fieldAt(sXZ).x)); // Patch: the painted wetness
        diffuseColor.rgb *= mix(1.0, uWetDarken, wet);

        // Dry soil cracks: recessed channels of a warped cellular plate network.
        float cracks = soilCrackAt(sXZ) * uCrackAmount;
        diffuseColor.rgb *= (1.0 - 0.7 * cracks);

        // Moss cover: lay the moss albedo (own tiling, tint & AO) over the soil
        // wherever the mask says it has grown. The moss's HEIGHT is added in the
        // vertex stage (groundHeightAt), so this only handles the surface look.
        float mossMask = mossMaskAt(sXZ);
        vec2  mossUv   = sXZ * uMossTextureScale;
        vec3  mossAlb  = pow(texture2D(uMossMap, mossUv).rgb, vec3(2.2)) * uMossColor;
        float mossAo   = mix(1.0, texture2D(uMossAoMap, mossUv).r, uMossAoStrength);
        mossAlb *= mossAo;
        diffuseColor.rgb = mix(diffuseColor.rgb, mossAlb, mossMask);`
      )
      // Wet soil is glossier; cracks read dull and matte; moss carries its own map.
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uWetRoughness, wet);
        roughnessFactor = mix(roughnessFactor, 1.0, cracks);
        float mossRough = texture2D(uMossRoughnessMap, sXZ * uMossTextureScale).g * uMossRoughness;
        roughnessFactor = mix(roughnessFactor, clamp(mossRough, 0.04, 1.0), mossMask);`
      )
      // Moss normal-map detail, then the displaced-mound relief normal on top.
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec3 mossN = texture2D(uMossNormalMap, sXZ * uMossTextureScale).xyz * 2.0 - 1.0;
        mossN.xy *= uMossNormalScale;
        vec3 mossViewN = normalize(tbn * mossN);
        normal = normalize(mix(normal, mossViewN, mossMask));
        if (uReliefShading > 0.001) { // Patch: skipped when off
          vec3 gN = groundSurfaceNormal(vWorldPosition.xz);
          vec3 gView = normalize((viewMatrix * vec4(gN, 0.0)).xyz);
          normal = normalize(mix(normal, gView, uReliefShading));
        }

        // Crack grooving: tilt the surface into each fissure so the walls catch
        // light and the plates read as raised, cracked crust (not a flat decal).
        if (uCrackEnabled > 0.5) { // Patch: skipped when the cracks are off
          float ce = 0.02;
          float c0 = soilCrackAt(sXZ);
          float cx = soilCrackAt(sXZ + vec2(ce, 0.0));
          float cz = soilCrackAt(sXZ + vec2(0.0, ce));
          vec2  cGrad = vec2(cx - c0, cz - c0) / ce;
          float cDepth = uCrackDepth * uCrackAmount;
          vec3  crackN = normalize(vec3(-cGrad.x * cDepth, 1.0, -cGrad.y * cDepth));
          vec3  crackView = normalize((viewMatrix * vec4(crackN, 0.0)).xyz);
          normal = normalize(mix(normal, crackView, smoothstep(0.02, 0.5, cracks)));
        }`
      );
  };
  // Distinct cache key so this program isn't shared with a plain StandardMaterial.
  material.customProgramCacheKey = () => 'soil-moss-patch-v1';
}
