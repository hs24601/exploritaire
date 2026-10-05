/** Object gestures own input until all their pointers and native drag end. */
export class CameraInteractionLock {
  private pointers = new Set<number>();
  private nativeDrag = false;
  get locked() { return this.nativeDrag || this.pointers.size > 0; }
  beginPointer(id: number) { this.pointers.add(id); }
  endPointer(id: number) { this.pointers.delete(id); }
  beginNativeDrag() { this.nativeDrag = true; }
  clear() { this.pointers.clear(); this.nativeDrag = false; }
}
