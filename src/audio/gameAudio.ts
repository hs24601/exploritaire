type CardPlaceSoundOptions = {
  combo: number;
  lane?: number;
  laneCount?: number;
};

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastCardPlaceAt = 0;
  private muted = false;

  private ensureReady(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;

      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -12;
      this.limiter.knee.value = 12;
      this.limiter.ratio.value = 10;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.08;

      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    if (!this.noiseBuffer && this.ctx) {
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.07);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    return buffer;
  }

  private createPan(ctx: AudioContext, lane: number | undefined, laneCount: number | undefined): StereoPannerNode {
    const panner = ctx.createStereoPanner();
    if (typeof lane === 'number' && typeof laneCount === 'number' && laneCount > 1) {
      const normalized = (lane / (laneCount - 1)) * 2 - 1;
      panner.pan.value = Math.max(-0.85, Math.min(0.85, normalized));
    } else {
      panner.pan.value = 0;
    }
    return panner;
  }

  playCardPlace(options: CardPlaceSoundOptions): void {
    if (this.muted) return;
    const ctx = this.ensureReady();
    if (!ctx || !this.master) return;

    const now = ctx.currentTime;
    if (now - this.lastCardPlaceAt < 0.012) return;
    this.lastCardPlaceAt = now;

    const combo = Math.max(0, options.combo || 0);
    const comboT = Math.min(1, combo / 20);
    const baseFreq = 180 + comboT * 120;
    const pitchRate = 1 + comboT * 0.22;
    const hitGain = 0.12 + comboT * 0.08;
    const pan = this.createPan(ctx, options.lane, options.laneCount);
    pan.connect(this.master);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(baseFreq, now);
    body.frequency.exponentialRampToValueAtTime(Math.max(80, baseFreq * 0.58), now + 0.09 / pitchRate);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(hitGain, now + 0.006);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    body.connect(bodyGain);
    bodyGain.connect(pan);
    body.start(now);
    body.stop(now + 0.12);

    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(900 + comboT * 450, now);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.03 + comboT * 0.03, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    click.connect(clickGain);
    clickGain.connect(pan);
    click.start(now);
    click.stop(now + 0.04);

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1200 + comboT * 1800;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.018 + comboT * 0.02, now + 0.002);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(pan);
      noise.start(now);
      noise.stop(now + 0.05);
    }

    if (combo >= 5) {
      const thud = ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(95 + comboT * 20, now);
      thud.frequency.exponentialRampToValueAtTime(55, now + 0.1);
      const thudGain = ctx.createGain();
      thudGain.gain.setValueAtTime(0.0001, now);
      thudGain.gain.exponentialRampToValueAtTime(0.045 + comboT * 0.035, now + 0.01);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      thud.connect(thudGain);
      thudGain.connect(pan);
      thud.start(now);
      thud.stop(now + 0.14);
    }

    if (combo >= 10) {
      const harmony = ctx.createOscillator();
      harmony.type = 'sine';
      harmony.frequency.setValueAtTime(baseFreq * 1.5, now);
      const harmonyGain = ctx.createGain();
      harmonyGain.gain.setValueAtTime(0.0001, now);
      harmonyGain.gain.exponentialRampToValueAtTime(0.028 + comboT * 0.03, now + 0.015);
      harmonyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      harmony.connect(harmonyGain);
      harmonyGain.connect(pan);
      harmony.start(now);
      harmony.stop(now + 0.19);
    }
  }

  setMuted(next: boolean): void {
    this.muted = next;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

const engine = new GameAudioEngine();

export function playCardPlaceSound(options: CardPlaceSoundOptions): void {
  engine.playCardPlace(options);
}

export function setGameAudioMuted(next: boolean): void {
  engine.setMuted(next);
}

export function isGameAudioMuted(): boolean {
  return engine.isMuted();
}
