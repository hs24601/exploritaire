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

/** A solid has a two-axis footprint. Fit it once in world space, leaving
 * enough depth behind/in front of its anchor at every camera heading. */
export function fitSceneryVolumeFootprint(foot: { x: number; y: number }, width: number, height: number,
  owner: { x: number; y: number; width: number; height: number }, padding = 1) {
  const halfX=Math.max(0,owner.width/2-padding),halfY=Math.max(0,owner.height/2-padding);
  const scale=Math.min(1,halfX*2/Math.max(width,1e-6),halfY*2/Math.max(width,1e-6)),fittedWidth=width*scale;
  const clamp=(value:number,centre:number,half:number)=>centre+Math.max(-half,Math.min(half,value-centre));
  return {position:{x:clamp(foot.x,owner.x,Math.max(0,halfX-fittedWidth/2)),y:clamp(foot.y,owner.y,Math.max(0,halfY-fittedWidth/2))},width:fittedWidth,height:height*scale};
}
/** Reserve a 16-unit-wide cross for centered actors and orthogonal travel.
 * Props fit in a fixed corner, so occupancy and camera motion never move them. */
export function walkableSceneryOwner(foot: { x: number; y: number },
  owner: { x: number; y: number; width: number; height: number }) {
  const width = Math.max(0, owner.width / 2 - 8), height = Math.max(0, owner.height / 2 - 8);
  return { x: owner.x + (foot.x < owner.x ? -1 : 1) * (8 + width / 2),
    y: owner.y + (foot.y <= owner.y ? -1 : 1) * (8 + height / 2), width, height };
}

