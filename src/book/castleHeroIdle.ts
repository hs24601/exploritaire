import type {SpriteView} from '../proto/directionalSprites';

const activities = ['pant', 'scratch', 'sniff', 'curious'] as const;
type AmbientActivity = typeof activities[number];
type Rest = 'stand' | 'sit' | 'prone';
export type CastleHeroActivity = AmbientActivity | Exclude<Rest, 'stand'>;
type Beat = readonly [frame: number, seconds: number];
type IdlePose = {frame: number; action: CastleHeroActivity | 'stand' | 'blink'};

const restFrame: Record<Rest, number> = {stand: 0, sit: 5, prone: 7};
const standBeforeSit = 8;
const sitBeforeProne = 12;

const sequences: Record<Exclude<AmbientActivity, 'pant'>, readonly Beat[]> = {
  scratch: [[4, .25], [5, .36], [8, .24], [9, .16], [8, .15], [9, .16],
    [8, .15], [9, .17], [8, .22], [5, .42], [4, .25]],
  sniff: [[10, .55], [11, .72], [10, .34], [12, .72], [10, .38]],
  curious: [[13, .48], [14, 1.24], [15, .54], [13, .24]],
};

export const CASTLE_IDLE_ATLAS = {
  root: 'characters/hero/castle/activities-v1/',
  cell: 256,
  columns: 4,
  size: 1024,
  planeSize: 1.4,
} as const;

export const CASTLE_IDLE_VIEWS = [
  'low-0', 'low-1', 'low-2', 'low-3', 'low-4',
  'high-0', 'high-1', 'high-2', 'high-3', 'high-4', 'top-0',
] as const;
type CastleIdleView = typeof CASTLE_IDLE_VIEWS[number];

export function castleIdleView(view: SpriteView): CastleIdleView {
  return view.elevation === 'top' ? 'top-0' : CASTLE_IDLE_VIEWS[(view.elevation === 'high' ? 5 : 0) + view.direction];
}

export function castleIdleRect(frame: number) {
  const {cell, columns} = CASTLE_IDLE_ATLAS;
  return [frame % columns * cell, Math.floor(frame / columns) * cell, cell, cell] as const;
}

/** The orbit chooses an atlas independently of this clock, so a camera turn
 * continues the same beat and mirrored yaw never starts a second activity. */
export class CastleHeroIdle {
  private rest: Rest = 'stand';
  private remaining = 0;
  private blinkIn = 0;
  private blinkLeft = 0;
  private action?: CastleHeroActivity;
  private beats: readonly Beat[] = [];
  private beat = 0;
  private next: AmbientActivity[] = [];
  private wasStill = false;

  constructor(private readonly random = Math.random) {}

  reset() {
    this.action = undefined;
    this.wasStill = false;
    this.next = [];
  }

  update(dt: number, still: boolean, reduced: boolean): IdlePose {
    if (!still || reduced) {
      this.action = undefined;
      this.wasStill = false;
      return {frame: 0, action: 'stand'};
    }
    if (!this.wasStill) {
      this.wasStill = true;
      this.rest = 'stand';
      this.remaining = standBeforeSit;
      this.blinkIn = this.blinkDelay();
      this.blinkLeft = 0;
    }

    this.remaining -= dt;
    if (this.action) {
      while (this.remaining <= 0 && ++this.beat < this.beats.length) {
        this.remaining += this.beats[this.beat][1];
      }
      if (this.beat < this.beats.length) return {frame: this.beats[this.beat][0], action: this.action};
      this.action = undefined;
      this.remaining = this.rest === 'sit' ? sitBeforeProne : this.activityDelay();
    } else if (this.remaining <= 0) {
      return this.advanceRest();
    }

    if (this.rest !== 'stand') return {frame: restFrame[this.rest], action: this.rest};
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkIn = this.blinkDelay();
      this.blinkLeft = .14;
    }
    return this.blinkLeft > 0 ? {frame: 1, action: 'blink'} : {frame: 0, action: 'stand'};
  }

  private activityDelay() { return 6 + this.random() * 9; }
  private blinkDelay() { return 3.5 + this.random() * 4.5; }

  private advanceRest(): IdlePose {
    if (this.rest === 'stand') {
      this.rest = 'sit';
      return this.start('sit', [[4, .28]]);
    }
    if (this.rest === 'sit') {
      this.rest = 'prone';
      return this.start('prone', [[6, .4]]);
    }

    if (!this.next.length) this.next = [...activities];
    const choice = Math.floor(this.random() * this.next.length);
    const action = this.next.splice(choice, 1)[0];
    const beats = action === 'pant' ? this.pant() : sequences[action];
    // Reverse the lowering pose to get up, then lower back to the same rest.
    return this.start(action, [[6, .25], [0, .16], ...beats, [6, .35]]);
  }

  private start(action: CastleHeroActivity, beats: readonly Beat[]): IdlePose {
    this.action = action;
    this.beats = beats;
    this.blinkLeft = 0;
    this.beat = 0;
    this.remaining = beats[0][1];
    return {frame: beats[0][0], action};
  }

  private pant(): Beat[] {
    const breaths = 2 + Math.floor(this.random() * 3);
    const breath: Beat[] = [[2, .13], [3, .19], [2, .16]];
    return [...Array.from({length: breaths}, () => breath).flat(), [0, .18]];
  }
}
