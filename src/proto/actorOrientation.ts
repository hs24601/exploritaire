export type ArenaPoint = { x: number; z: number };
export type ActorFacing =
  | { kind: 'opponents' }
  | { kind: 'target'; actorId: string }
  | { kind: 'point'; point: ArenaPoint }
  | { kind: 'fixed'; yaw: number };
export type OrientedActor = { id: string; team: string; position: ArenaPoint; facing?: ActorFacing };

/** Table movement shares combat's world convention: +Y/+Z is heading zero.
 * A stationary actor retains its heading, regardless of camera or pose changes. */
export function movementHeading(position: { x: number; y: number }, previous: { x: number; y: number; heading: number } | undefined, authored?: number) {
  if (authored !== undefined) return authored;
  if (!previous || Math.hypot(position.x - previous.x, position.y - previous.y) < .001) return previous?.heading ?? 0;
  return Math.atan2(position.x - previous.x, position.y - previous.y);
}

/** A single-view actor is a fixed physical plane, never a camera billboard.
 * Directional rigs may billboard their canvas while selecting world-relative art. */
export function worldActorTransform(heading: number, upright: boolean, oversample = 1) {
  const degrees = -heading * 180 / Math.PI;
  return upright
    ? `translate(-50%, -100%) rotateZ(${degrees}deg) rotateX(-90deg) scale(${1 / oversample})`
    : `translate(-50%, -50%) rotate(${degrees}deg)`;
}

/** Heading is gameplay/world data. Camera movement never changes it. +Z is yaw 0. */
export function actorHeading(actor: OrientedActor, actors: readonly OrientedActor[], previous = 0): number {
  const policy = actor.facing ?? { kind: 'opponents' };
  if (policy.kind === 'fixed') return policy.yaw;
  let target: ArenaPoint | undefined;
  if (policy.kind === 'point') target = policy.point;
  else if (policy.kind === 'target') target = actors.find(other => other.id === policy.actorId)?.position;
  // A missing explicit target falls back to the opposing team's live centre.
  if (!target) {
    const opponents = actors.filter(other => other.team !== actor.team);
    if (opponents.length) target = {
      x: opponents.reduce((sum, other) => sum + other.position.x, 0) / opponents.length,
      z: opponents.reduce((sum, other) => sum + other.position.z, 0) / opponents.length,
    };
  }
  if (!target || Math.hypot(target.x - actor.position.x, target.z - actor.position.z) < 1e-6) return previous;
  return Math.atan2(target.x - actor.position.x, target.z - actor.position.z);
}

/** Project the world heading onto an upright billboard's right axis.
 * Side art stays readable during an orbit; a dead band prevents head-on flip chatter.
 * Authored left/right describes the SOURCE art, independently of the actor's team.
 */
export function billboardFacing(yaw: number, billboardYaw: number, authored: 'left' | 'right', previous = 1): number {
  const right = Math.sin(yaw) * Math.cos(billboardYaw) - Math.cos(yaw) * Math.sin(billboardYaw);
  if (Math.abs(right) < .035) return previous;
  return (right > 0 ? 1 : -1) * (authored === 'right' ? 1 : -1);
}
