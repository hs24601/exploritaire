# Fireball cast effect and power hooks

The cast projectile adapts the sphere/polar noise, tapered steam cylinder and noise-displaced flame cylinder supplied by Eric on 2026-11-16. It uses the installed Three.js version, the existing renderer, and an isolated UnrealBloomPass target. The original watercolor remains the card/constellation painting; casting uses no watercolor projectile.

Texture originals are cached locally under `public/assets/runtime/spells/fireball/shader-v1/` from the three URLs supplied with the snippet:

- https://raw.githubusercontent.com/pizza3/asset/master/noise9.jpg
- https://raw.githubusercontent.com/pizza3/asset/master/sparklenoise.jpg
- https://raw.githubusercontent.com/pizza3/asset/master/water-min.jpg

No runtime CDN imports, dat.GUI, OrbitControls, extra canvas, or independent animation loop are introduced. Shader alpha/compositing, geometry APIs, timing, bloom threshold and renderer state handling are adapted for the game's current Three version. Bloom affects the spell only.

## Tuning

Defaults and receipt scaling: `src/book/fireballPower.ts`. Renderer: `src/book/fireballEffect.ts`.

The `fireballTuning` option on `createWoodsSpellTest` sets initial authoring overrides. In `portals.html?combat`, update the current effect (including during a cast) through:

```js
__castle1111.configureFireball({
  sizeScale: 1.3,
  trailScale: 1.2,
  grandeur: 1.4,
  receiptInfluence: 1,
  powerCurve: .85,
  emberDensity: 1,
  bloomStrength: 3.5,
  bloomRadius: .39,
  exposure: 2.8,
  flightDuration: 2.4
});
```

`baseRadius` sets the head's reference pixel radius before viewport fitting and receipt growth. `sizeScale` scales the head and body; `trailScale` independently stretches the trail; `grandeur` adjusts radiance, ember count and impact spread. `receiptInfluence: 0` disables automatic receipt growth while retaining the explicit authoring scales. `powerCurve` controls the sublinear logarithmic growth response. Other values independently tune ember density, bloom, exposure and flight duration. Overrides last for the current scene instance; reload restores defaults. Invalid values throw and numeric extremes are clamped to supported authoring ranges.

Inspect `__castle1111.spells.fireball` for the current tuning, receipt-derived profile, normalized launch/target points, flight/impact progress and texture readiness. Visual tuning does not change damage or the four-receipt cast gate.

Casting pans the real camera up to a lit, unpainted constellation, then launches from a distant world-space sky position. The camera tracks the world-space meteor down to the actor, with projected size scaled by distance. Fireball damage and impact feedback fire on arrival. Eligible target outlines are white until the dragged card overlaps the actor, then red for hostile spells or blue for support spells. Pause freezes shader and flight clocks; reduced motion shows a short static impact instead of travel. Leaving cancels the effect. Low FX limits bloom resolution and ember count; render targets resize only when their budget changes and are disposed with the scene.
