# Terrain View — Path B: Pixi.js WebGL Enhancement

This document describes the WebGL-native upgrade path for the exploration terrain view,
to be pursued after Path A (CSS/SVG terrain) has validated the UX and content model.

---

## Context

Path A implements the over-the-shoulder terrain view using layered CSS/SVG — stylized
terrain objects, parallax via CSS `transform`, party silhouettes as fixed SVG elements.
This is sufficient for prototyping and gameplay validation. Path B replaces or augments
that layer with the existing Pixi.js Application, unlocking GPU-accelerated effects,
procedural shaders, and deep compositing with the watercolor system.

---

## The one hard constraint: WebGL context budget

Browsers limit WebGL contexts per page (typically 8–16 total; practically 2–4 before
warnings and degraded performance). The game already creates one WebGL context for
`WatercolorCanvas.tsx`. **Do not create a second `pixi.js Application`** for terrain.

**Correct approach:** Extend the existing Application in `WatercolorCanvas.tsx` with
additional Pixi.js `Container` layers for terrain, driven by game state passed via
`WatercolorContext`.

---

## Target layer architecture (within WatercolorCanvas)

```
Pixi.js Application (single WebGL context)
  │
  ├── Layer 0: Paper grain texture          ← already exists
  │
  ├── Layer 1: Sky / horizon gradient       ← NEW — biome atmosphere
  │     TilingSprite or Graphics fill
  │     Color keyed to current biome
  │
  ├── Layer 2: Far terrain (parallax slow)  ← NEW
  │     Container of stylized mountain/canopy sprites
  │     Moves at ~0.15× step distance per step
  │
  ├── Layer 3: Mid terrain (parallax med)   ← NEW
  │     Container of terrain objects (trees, rocks, dunes)
  │     Moves at ~0.45× step distance per step
  │
  ├── Layer 4: Near terrain (parallax fast) ← NEW
  │     Ground plane + near objects
  │     Moves at 1.0× step distance per step (full scroll)
  │
  ├── Layer 5: Party silhouettes            ← NEW — fixed position
  │     Three Graphics objects (Fox, Wolf, Owl)
  │     Anchored to bottom-center, never move
  │
  ├── Layer 6: Persistent paint RenderTexture ← already exists (watercolor marks)
  │
  └── Layer 7: Active splash animations    ← already exists
```

Terrain layers (1–5) sit **below** the watercolor paint layers (6–7), so watercolor
splashes paint *over* terrain. This creates the signature look of watercolor washing
across a landscape.

---

## Extending WatercolorCanvas.tsx

The terrain state should be passed in via a new optional prop or via `WatercolorContext`.
The key values needed are:

```typescript
interface TerrainState {
  biome: string;              // e.g. 'forest', 'mountain', 'desert', 'dungeon'
  facing: Direction;          // current heading from explorationHeading
  stepProgress: number;       // 0.0–1.0, fraction of next step completed
  stepTrigger: number;        // increment each full step, drives scroll animation
}
```

Inside `WatercolorCanvas.tsx` (`handleInit` and the render loop):

```typescript
// On init: create terrain containers
const skyLayer = new PIXI.Graphics();
const farContainer = new PIXI.Container();
const midContainer = new PIXI.Container();
const nearContainer = new PIXI.Container();
const silhouetteContainer = new PIXI.Container();

app.stage.addChildAt(skyLayer, 0);
app.stage.addChildAt(farContainer, 1);
app.stage.addChildAt(midContainer, 2);
app.stage.addChildAt(nearContainer, 3);
app.stage.addChildAt(silhouetteContainer, 4);
// existing RenderTexture sprite sits above at index 5+
```

Parallax scroll on step: use Pixi.js Ticker or a short `requestAnimationFrame` tween
to animate `container.x` offset based on `facing` direction and `stepProgress`.

---

## God ray (crepuscular ray) shader

Path A approximates light shafts using static SVG polygons placed in tree gaps.
Path B replaces this with a proper screen-space god ray effect (Mittring 2007),
running entirely on the GPU at negligible CPU cost.

### Technique overview

The effect is a two-pass screen-space radial blur:

**Pass 1 — occluder map**
Render the terrain silhouettes (sky = white, trees/terrain objects = black) into an
offscreen `PIXI.RenderTexture`. This is the light exclusion map.

**Pass 2 — radial blur filter**
For each screen pixel, march `N` steps toward the sun's screen position, sampling the
occluder map. Attenuate each sample by a decay factor. Accumulate into a ray buffer.
Composite over the scene with additive blending.

```glsl
// godray.frag — screen-space crepuscular rays (Mittring 2007)
// Attach as a PIXI Filter on the terrain container.

uniform sampler2D uOccluderMap;   // Pass 1 silhouette texture
uniform vec2      uLightPos;      // Sun position in normalised screen coords [0..1]
uniform float     uExposure;      // Ray intensity multiplier (try 0.08–0.15)
uniform float     uDecay;         // Attenuation per step (try 0.96–0.99)
uniform float     uWeight;        // Per-sample contribution (try 0.03–0.06)
uniform float     uDensity;       // Sample spread; 1.0 = full screen radius

const int NUM_SAMPLES = 64;       // 64 sufficient; 100 for hero quality

void main() {
  vec2  uv    = vUv;
  vec2  delta = (uv - uLightPos) / float(NUM_SAMPLES) * uDensity;
  float decay = 1.0;
  float accum = 0.0;

  for (int i = 0; i < NUM_SAMPLES; i++) {
    uv   -= delta;
    float occluded = texture2D(uOccluderMap, clamp(uv, 0.0, 1.0)).r;
    accum += occluded * decay * uWeight;
    decay *= uDecay;
  }

  gl_FragColor = vec4(vec3(accum * uExposure), accum * uExposure);
  // Composite on scene with BLEND_MODES.ADD (additive light accumulation).
}
```

### Pixi.js integration

```typescript
// On init — create the occluder RenderTexture
const occluderRT = PIXI.RenderTexture.create({ width, height });

// Each frame (in Ticker):
// 1. Tint all terrain containers black, render to occluderRT, restore tint.
app.renderer.render(terrainStage, { renderTexture: occluderRT, clear: true });

// 2. Apply god ray filter to the composited scene.
const godRayFilter = new PIXI.Filter(undefined, godRayFrag, {
  uOccluderMap: occluderRT,
  uLightPos:    [sunScreenX / width, sunScreenY / height],
  uExposure:    biomeDef.rayExposure ?? 0.10,
  uDecay:       0.97,
  uWeight:      0.04,
  uDensity:     0.95,
});
sceneContainer.filters = [godRayFilter];
```

### Biome ray parameters

```typescript
const BIOME_RAYS: Record<string, { exposure: number; color: [number,number,number] }> = {
  forest:   { exposure: 0.10, color: [0.78, 0.95, 0.55] },  // green-gold dapple
  mountain: { exposure: 0.08, color: [0.75, 0.88, 1.00] },  // ice-blue alpine
  desert:   { exposure: 0.18, color: [1.00, 0.88, 0.45] },  // harsh amber
  dungeon:  { exposure: 0.00, color: [0.00, 0.00, 0.00] },  // no rays — darkness
  plains:   { exposure: 0.09, color: [0.88, 0.98, 0.65] },  // soft daylight
};
```

### Performance notes

- NUM_SAMPLES=64 costs ~0.3ms on mid-range mobile GPU (measured via `gl.getExtension('EXT_disjoint_timer_query')`).
- The occluder pass reuses the terrain containers already drawn — no additional geometry.
- Reuse the same `RenderTexture` allocation every frame; never create a new one in the Ticker.
- The blur radius in screen space scales with `uDensity`; reduce it on low-end devices.
- Grain texture from `GranulationShader.ts` can be added as `uNoise` to break up the
  shaft banding artifact that appears with low `NUM_SAMPLES`.

### Migration from Path A SVG shafts

Path A shafts are SVG polygons placed at tree gap midpoints with a Gaussian blur filter.
They are static per step and have zero per-frame CPU cost, making them a good placeholder.
Path B god rays replace them automatically once the `terrain=2` flag is active:
- `TerrainView.tsx` renders nothing in Path B mode.
- The Pixi.js god ray filter handles the effect.
- No SVG shaft code needs to be removed from `TerrainView.tsx` until Path B is shipped.

---

## Procedural terrain shader approach

For rich terrain (foliage density, fog, lighting), write a fragment shader similar to
the existing `GranulationShader.ts` pattern:

```glsl
// terrain.frag (sketch)
uniform sampler2D uGrainTexture;
uniform float uDepth;       // 0.0 = sky, 1.0 = ground
uniform float uFogDensity;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform float uTime;

void main() {
  float grain = texture2D(uGrainTexture, vUv * 4.0).r;
  vec3 baseColor = mix(uSkyColor, uGroundColor, vUv.y);

  // Horizon fog
  float fog = smoothstep(0.3, 0.7, vUv.y) * uFogDensity;
  baseColor = mix(baseColor, uSkyColor, fog);

  // Organic noise edge (reuse watercolor noise pattern)
  float edge = grain * 0.08;
  gl_FragColor = vec4(baseColor + edge, 1.0);
}
```

The existing grain texture (`GranulationShader.ts`) can be reused directly — pass the
same `uGrainTexture` uniform to the terrain shader to maintain visual consistency.

---

## Biome → terrain asset mapping

```typescript
const BIOME_TERRAIN: Record<string, BiomeTerrain> = {
  forest:   { skyColor: [0.18, 0.28, 0.22], objectType: 'tree',     fogDensity: 0.6 },
  mountain: { skyColor: [0.55, 0.62, 0.70], objectType: 'peak',     fogDensity: 0.3 },
  desert:   { skyColor: [0.78, 0.68, 0.42], objectType: 'dune',     fogDensity: 0.1 },
  dungeon:  { skyColor: [0.05, 0.04, 0.08], objectType: 'pillar',   fogDensity: 0.8 },
  plains:   { skyColor: [0.40, 0.60, 0.75], objectType: 'grass',    fogDensity: 0.2 },
};
```

Terrain objects are Pixi.js `Graphics` drawn procedurally — no external asset files
required until an art pass is warranted.

---

## POI diegetic rendering

POIs within a configurable radius of the player's current node should appear as terrain
objects at the appropriate parallax depth. Approach:

1. Project the POI's world `(x, y)` relative to the player's current position and facing.
2. Map the relative position to a screen `(x, depth)` using the same isometric
   projection from `ExplorationMap.tsx` — the math is already correct there.
3. Add a Pixi.js `Container` at that screen position, scaled by `depth` (far = small,
   near = large).
4. As the player approaches, `depth` increases → object scales up organically.

This reuses the projection math from `src/components/ExplorationMap.tsx: projectRaw()`.

---

## Performance considerations

- **Single render pass**: terrain + watercolor composite in one WebGL draw pass.
- **Object pooling**: reuse `Graphics` objects for terrain elements; only update
  transforms, not geometry, on each step.
- **LOD by depth**: far-layer objects use fewer vertices (simplified silhouettes);
  near-layer objects get full detail.
- **Respect drag degradation**: the existing `dragDegradation` system in
  `WatercolorOverlay.tsx` should also throttle terrain animation during drag.
- **Reuse grain texture**: share the 256×256 grain `RenderTexture` already generated
  by the watercolor system — no new GPU texture allocation needed for terrain noise.

---

## Implementation checklist

Work through these in dependency order. Model recommendations based on task complexity.

| # | Step | Model | Status |
|---|------|-------|--------|
| 1 | TerrainState in WatercolorContext | Sonnet | ✓ |
| 2 | Stage layer insertion in WatercolorCanvas | Sonnet | ✓ |
| 3 | Pixi Graphics terrain objects + Ticker parallax | Sonnet | ✓ |
| 4 | God ray shader (occluder RT + Mittring filter) | **Opus** | ✓ |
| 5 | `terrain=2` URL gate + TerrainView no-op | Haiku | — |
| 6 | ShadowCanvas suppression update | Haiku | — |
| 7 | POI diegetic rendering *(post-launch)* | Sonnet | — |

---

## Migration path from Path A

Path A (CSS/SVG) and Path B (Pixi.js) can coexist during transition:

1. Keep the `terrain=1` URL param gate in place.
2. Add a `terrain=2` value that activates Path B rendering instead of Path A.
3. The `TerrainView.tsx` React component (Path A) becomes a thin wrapper:
   - When Path A: renders SVG/CSS layers directly.
   - When Path B: renders nothing (a transparent div); Pixi.js handles the visuals.
4. Once Path B is validated, remove `TerrainView.tsx` and the `terrain=1` path.
5. Remove the URL gate; terrain becomes always-on for the RPG variant.

---

## Relevant files

| File | Relevance |
|------|-----------|
| `src/watercolor-engine/WatercolorCanvas.tsx` | Extend with terrain layers |
| `src/watercolor-engine/WatercolorContext.tsx` | Add `TerrainState` to context |
| `src/watercolor-engine/shaders/GranulationShader.ts` | Reference for shader pattern |
| `src/components/ExplorationMap.tsx` | `projectRaw()` — reuse projection math |
| `src/components/CombatGolf.tsx` | Source of truth for biome, heading, step state |
| `src/App.tsx` | URL param parsing (lines ~163–173) |
