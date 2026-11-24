import { comboCutoff, degreeMidi, midiHz, rankDegree, type MusicKey } from '../audio/musicScale';
import { TIER_STEPS } from './stellarRules';

/** Synthesized astral sound for the stellar grid: glass bells, a night drone
 * and a long shimmer reverb. Pitch is the card's rank in E lydian, so a run is
 * a scale. Sequencing receipts ramp the mix: from chain 3 a sparkle octave,
 * from 5 a harmony third and an opening drone, from 8 a sub pulse and a
 * rising swell. Breaking the chain replays the figure as a quick arpeggio
 * and lets the drone settle. Nothing is sampled; it all starts on the play. */
const KEY: MusicKey = { root: 64, mode: 'lydian' };
const PARTIALS = [[1, 1, 1], [2.01, 0.32, 0.6], [2.76, 0.22, 0.42], [5.4, 0.09, 0.24]] as const;

export class StellarAudio {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private dry: GainNode | null = null;
  private verb: GainNode | null = null;
  private echo: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;

  get isMuted() { return this.muted; }

  /** Call from a user gesture; browsers keep audio locked until then. */
  wake() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.build(new Ctx());
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private build(ctx: AudioContext) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
    this.out = ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.8; this.out.connect(comp); comp.connect(ctx.destination);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.75; this.dry.connect(this.out);
    // Long, bright, gently darkening shimmer tail.
    const verb = ctx.createConvolver(), seconds = 4.2, length = Math.floor(ctx.sampleRate * seconds), ir = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const data = ir.getChannelData(ch); let low = 0; for (let i = 0; i < length; i++) { const t = i / length; low += ((Math.random() * 2 - 1) - low) * (0.6 - 0.45 * t); data[i] = low * (1 - t) ** 2.6; } }
    verb.buffer = ir; this.verb = ctx.createGain(); this.verb.gain.value = 0.55; this.verb.connect(verb); verb.connect(this.out);
    // Ping-pong dotted-eighth echo at 84 bpm, softened on each repeat.
    const left = ctx.createDelay(1), right = ctx.createDelay(1), fb = ctx.createGain(), tone = ctx.createBiquadFilter(), merge = ctx.createChannelMerger(2);
    left.delayTime.value = right.delayTime.value = 60 / 84 * 0.75; fb.gain.value = 0.32; tone.type = 'lowpass'; tone.frequency.value = 2600;
    this.echo = ctx.createGain(); this.echo.gain.value = 0.22; this.echo.connect(left); left.connect(tone); tone.connect(right); right.connect(fb); fb.connect(left);
    left.connect(merge, 0, 0); right.connect(merge, 0, 1); merge.connect(this.out); merge.connect(this.verb);
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noise = noise;
    // Night drone: root and fifth, detuned, behind a filter the chain opens.
    this.droneFilter = ctx.createBiquadFilter(); this.droneFilter.type = 'lowpass'; this.droneFilter.frequency.value = 260; this.droneFilter.Q.value = 0.7;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0; this.droneFilter.connect(this.droneGain); this.droneGain.connect(this.dry); this.droneGain.connect(this.verb);
    for (const [midi, detune] of [[KEY.root - 24, -7], [KEY.root - 24, 6], [KEY.root - 17, 3], [KEY.root - 12, -4]] as const) {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = midiHz(midi); osc.detune.value = detune; const g = ctx.createGain(); g.gain.value = 0.12; osc.connect(g); g.connect(this.droneFilter); osc.start();
    }
    const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = 0.07; depth.gain.value = 90; lfo.connect(depth); depth.connect(this.droneFilter.frequency); lfo.start();
    this.drone(0);
  }

  private get live() { return this.ctx && !this.muted && this.ctx.state === 'running' ? this.ctx : null; }

  private bell(freq: number, at: number, velocity: number, decay: number, bright = 3200, send = 0.4, echo = 0.2) {
    const ctx = this.ctx!, filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    filter.type = 'lowpass'; filter.frequency.value = bright; amp.gain.value = 1;
    filter.connect(amp); amp.connect(this.dry!);
    const sendGain = ctx.createGain(); sendGain.gain.value = send; amp.connect(sendGain); sendGain.connect(this.verb!);
    const echoGain = ctx.createGain(); echoGain.gain.value = echo; amp.connect(echoGain); echoGain.connect(this.echo!);
    for (const [ratio, level, length] of PARTIALS) {
      const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = freq * ratio;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(velocity * level * 0.22, at + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, at + decay * length);
      osc.connect(g); g.connect(filter); osc.start(at); osc.stop(at + decay * length + 0.05);
    }
  }

  private whoosh(at: number, from: number, to: number, length: number, level: number, q = 4) {
    const ctx = this.ctx!, src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true; band.type = 'bandpass'; band.Q.value = q;
    band.frequency.setValueAtTime(from, at); band.frequency.exponentialRampToValueAtTime(to, at + length);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(level, at + length * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(band); band.connect(g); g.connect(this.dry!); g.connect(this.verb!); src.start(at); src.stop(at + length + 0.05);
  }

  private tone(freq: number, at: number, length: number, level: number, type: OscillatorType = 'sine', glide?: number) {
    const ctx = this.ctx!, osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, at);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, at + length);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(level, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(g); g.connect(this.dry!); g.connect(this.verb!); osc.start(at); osc.stop(at + length + 0.05);
  }

  /** The drone and the reverb open with the live chain, and settle when it ends. */
  private drone(chain: number) {
    const ctx = this.ctx; if (!ctx || !this.droneGain || !this.droneFilter || !this.verb) return;
    const t = ctx.currentTime, lift = Math.min(1, chain / 10);
    this.droneGain.gain.setTargetAtTime(0.05 + lift * 0.09, t, chain ? 0.25 : 1.2);
    this.droneFilter.frequency.setTargetAtTime(chain ? Math.min(2400, comboCutoff(chain) * 0.45) : 260, t, chain ? 0.2 : 1.4);
    this.verb.gain.setTargetAtTime(0.5 + lift * 0.35, t, 0.4);
  }

  /** A card lands on the foundation: `chain` counts this card. */
  receipt(rank: number, chain: number) {
    const ctx = this.live; if (!ctx) return;
    const t = ctx.currentTime + 0.005, degree = rankDegree(rank), hz = midiHz(degreeMidi(KEY, degree)), [three, five, eight] = TIER_STEPS;
    this.bell(hz, t, 0.9, 1.6 + Math.min(chain, 10) * 0.12, 2400 + chain * 260, 0.35 + Math.min(chain, 10) * 0.03);
    if (chain >= three) this.bell(hz * 4, t + 0.03, 0.28, 0.5, 9000, 0.6, 0.35);
    if (chain >= five) this.bell(midiHz(degreeMidi(KEY, degree + 2)), t + 0.05, 0.4, 1.8, 3600, 0.6);
    if (chain >= eight) {
      this.bell(midiHz(degreeMidi(KEY, degree + 4)), t + 0.09, 0.32, 2.2, 4200, 0.7);
      this.tone(midiHz(KEY.root - 24), t, 0.7, 0.16, 'sine', midiHz(KEY.root - 26));
      this.whoosh(t, 400, 5200, 0.45, 0.05, 2);
    }
    this.drone(chain);
  }

  /** The chain broke: replay the figure quickly, then a soft bloom on its last star. */
  chainEnd(ranks: readonly number[]) {
    const ctx = this.live; if (!ctx) { this.drone(0); return; }
    const t = ctx.currentTime + 0.02, notes = ranks.slice(-12);
    if (notes.length >= 3) {
      notes.forEach((rank, i) => this.bell(midiHz(degreeMidi(KEY, rankDegree(rank)) + 12), t + i * 0.055, 0.32, 0.9, 7000, 0.7, 0.3));
      const last = rankDegree(notes[notes.length - 1]), at = t + notes.length * 0.055;
      for (const step of [0, 2, 4]) this.bell(midiHz(degreeMidi(KEY, last + step)), at, 0.22, 2.6, 2600, 0.8, 0.1);
    }
    this.drone(0);
  }

  /** Choosing the foundation star. */
  pick(rank: number) {
    const ctx = this.live; if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    this.whoosh(t, 180, 2400, 0.7, 0.08, 3);
    this.bell(midiHz(degreeMidi(KEY, rankDegree(rank)) - 12), t + 0.25, 0.8, 2.8, 1800, 0.7);
    this.drone(1);
  }

  draw() {
    const ctx = this.live; if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.whoosh(t, 3800, 1600, 0.16, 0.05, 1.4);
    this.tone(midiHz(KEY.root - 12), t, 0.35, 0.05, 'triangle');
  }

  /** The Eclipse gathers: a low tick that rises with each draw toward its strike. */
  charge(draws: number) {
    const ctx = this.live; if (!ctx) return;
    this.tone(midiHz(KEY.root - 25 + draws * 3), ctx.currentTime + 0.12, 0.6, 0.09, 'triangle');
  }

  strike() {
    const ctx = this.live; if (!ctx) return;
    const t = ctx.currentTime + 0.02;
    this.tone(70, t, 0.9, 0.5, 'sine', 32);
    this.tone(midiHz(KEY.root - 13), t, 1.2, 0.05, 'sawtooth');
    this.tone(midiHz(KEY.root - 12), t, 1.2, 0.05, 'sawtooth');
    this.whoosh(t, 900, 120, 0.6, 0.12, 1);
  }

  /** The hit landing on the Eclipse: a short bright glint that gets brighter by tier. */
  impact(tier: number) {
    const ctx = this.live; if (!ctx) return;
    const t = ctx.currentTime + 0.18;
    this.tone(1800 + tier * 500, t, 0.14, 0.03 + tier * 0.012, 'sine', 600);
  }

  invalid() {
    const ctx = this.live; if (!ctx) return;
    this.tone(midiHz(KEY.root - 18), ctx.currentTime, 0.18, 0.06, 'triangle', midiHz(KEY.root - 20));
  }

  end(won: boolean) {
    const ctx = this.live; if (!ctx) return;
    const t = ctx.currentTime + 0.05, chord = won ? [0, 2, 4, 6, 7, 9, 11] : [4, 2, 1, 0, -3];
    chord.forEach((d, i) => this.bell(midiHz(degreeMidi(KEY, d) - (won ? 0 : 12)), t + i * (won ? 0.09 : 0.16), 0.5, won ? 3.5 : 2.5, won ? 5000 : 1400, 0.85));
    this.drone(0);
  }

  dispose() { void this.ctx?.close(); this.ctx = null; }
}
