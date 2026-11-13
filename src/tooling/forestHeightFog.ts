export type HeightFogSettings = { height: number; softness: number; density: number };

/** Three-point Simpson estimate of a smooth height bank along the view ray.
 * Includes the camera's height, so flight views look through a thinner bank. */
export function heightFogAmount(distance: number, cameraHeight: number, surfaceHeight: number, settings: HeightFogSettings) {
  const profile = (y: number) => {
    const t = Math.max(0, Math.min(1, (y - settings.height + settings.softness) / (2 * Math.max(.01, settings.softness))));
    return 1 - t * t * (3 - 2 * t);
  };
  const integrated = (profile(cameraHeight) + 4 * profile((cameraHeight + surfaceHeight) / 2) + profile(surfaceHeight)) / 6;
  return 1 - Math.exp(-Math.max(0, distance) * Math.max(0, settings.density) * integrated);
}

// Shared by painted, instanced reliefs and the terrain. World positions must
// include both depth displacement and instance transforms before calling this.
export const forestHeightFogGLSL = /* glsl */`
uniform vec3 fogColor;
uniform float fogHeight;
uniform float fogSoftness;
uniform float fogDensity;
float forestFogProfile(float y) {
  float softness = max(0.01, fogSoftness);
  return 1.0-smoothstep(fogHeight-softness, fogHeight+softness, y);
}
vec3 applyForestFog(vec3 color, vec3 worldPosition) {
  float distanceToCamera = length(cameraPosition-worldPosition);
  float bank = (forestFogProfile(cameraPosition.y)
    + 4.0*forestFogProfile((cameraPosition.y+worldPosition.y)*0.5)
    + forestFogProfile(worldPosition.y))/6.0;
  float amount = 1.0-exp(-distanceToCamera*fogDensity*bank);
  return mix(color, fogColor, clamp(amount,0.0,1.0));
}
`;
