type Point = {x: number; y: number};
type Contact = Point & {touch: boolean; pan: boolean; moved: boolean; start: Point};
type Actions = {
  free: () => boolean;
  orbit: (dx: number, dy: number) => void;
  pan: (dx: number, dy: number) => void;
  zoom: (logScale: number) => void;
  tap: (point: Point, teleport: boolean) => void;
  interruptTap?: () => void;
};

/** Pointer IDs keep a pinch separate from taps, including lifted/cancelled fingers.
 * Multi-contact changes rebase the gesture rather than moving the camera. */
export class CastleCameraGestures {
  private contacts = new Map<number, Contact>();
  constructor(private actions: Actions) {}
  down(id: number, point: Point, touch: boolean, pan: boolean, suppressTap = false) {
    this.contacts.set(id, {...point, start: point, touch, pan, moved: pan || suppressTap});
    if(pan||suppressTap||this.contacts.size>1)this.actions.interruptTap?.();
    if (this.contacts.size > 1) for (const p of this.contacts.values()) p.moved = true;
  }
  move(id: number, point: Point) {
    const p = this.contacts.get(id);
    if (!p) return;
    const before = [...this.contacts.values()].map(p => ({...p}));
    const dx = point.x - p.x, dy = point.y - p.y;
    if (this.contacts.size === 1) {
      if (!p.moved && Math.hypot(point.x-p.start.x, point.y-p.start.y) < 7) return;
      if(!p.moved)this.actions.interruptTap?.();
      p.moved = true;
      const pan = p.pan || (p.touch && this.actions.free());
      (pan ? this.actions.pan : this.actions.orbit)(dx, dy);
    }
    p.x = point.x; p.y = point.y;
    const after = [...this.contacts.values()];
    if (after.length === 2) {
      const oldDistance = Math.hypot(before[0].x-before[1].x, before[0].y-before[1].y);
      const newDistance = Math.hypot(after[0].x-after[1].x, after[0].y-after[1].y);
      if (this.actions.free()) this.actions.pan(dx / 2, dy / 2);
      if (oldDistance > 2 && newDistance > 2) this.actions.zoom(Math.log(oldDistance/newDistance));
    } else if (after.length >= 3) {
      const center = (points: Point[]) => ({x:points.reduce((s,p)=>s+p.x,0)/points.length, y:points.reduce((s,p)=>s+p.y,0)/points.length});
      const a = center(before), b = center(after);
      const turn = after.reduce((sum,p,i) => {
        const delta = Math.atan2(p.y-b.y,p.x-b.x)-Math.atan2(before[i].y-a.y,before[i].x-a.x);
        return sum + Math.atan2(Math.sin(delta),Math.cos(delta));
      },0) / after.length;
      this.actions.orbit(-turn / .005, b.y-a.y);
    }
  }
  up(id: number, point: Point, cancelled = false, teleport = false) {
    const p = this.contacts.get(id);
    // Releasing capture after a successful pointerup emits a second cleanup
    // event. Only cancel a tap pair when an actual contact is still pending.
    if(p&&cancelled)this.actions.interruptTap?.();
    this.contacts.delete(id);
    if (p && !cancelled && !p.moved && (teleport || !this.actions.free()) && Math.hypot(point.x-p.start.x,point.y-p.start.y) < 7) {
      this.actions.tap(point,teleport);
    }
  }
  clear() { this.contacts.clear();this.actions.interruptTap?.(); }
}
