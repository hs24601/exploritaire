/** A camera-facing vertical prop occupies a line on the ground. Its upright
 * height may rise above the tile, but its entire foot line stays in its owner. */
export function fitSceneryFootprint(foot: { x: number; y: number }, width: number, height: number,
  owner: { x: number; y: number; width: number; height: number }, yaw: number, padding = 1) {
  const angle = yaw * Math.PI / 180, c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const halfX = Math.max(0, owner.width / 2 - padding), halfY = Math.max(0, owner.height / 2 - padding);
  const maximum = Math.min(c > 1e-6 ? halfX * 2 / c : Infinity, s > 1e-6 ? halfY * 2 / s : Infinity);
  const scale = Math.min(1, maximum / Math.max(width, 1e-6));
  const fittedWidth = width * scale;
  const clamp = (value: number, centre: number, limit: number) => centre + Math.max(-limit, Math.min(limit, value - centre));
  return { position: { x: clamp(foot.x, owner.x, Math.max(0, halfX - fittedWidth * c / 2)),
    y: clamp(foot.y, owner.y, Math.max(0, halfY - fittedWidth * s / 2)) }, width: fittedWidth, height: height * scale };
}
