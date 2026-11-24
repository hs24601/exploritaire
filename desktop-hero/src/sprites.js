'use strict';
// Loads Hero's painted platforming suites from the game's runtime assets and
// provides a small animation clock (same rules as suite-v1/player.mjs).

const fs = require('node:fs');
const path = require('node:path');

const ASSET_ROOT = path.resolve(__dirname, '..', '..', 'public', 'assets', 'runtime', 'characters', 'hero', 'platforming');
const SHEETS = { suite: 'suite-v1', idle: 'idle-v2' };

function loadSprites(root = ASSET_ROOT) {
  const animations = new Map();
  const clips = new Map();
  for (const [sheet, dir] of Object.entries(SHEETS)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, dir, 'manifest.json'), 'utf8'));
    for (const clip of manifest.clips) {
      const anchor = clip.anchor || 'feet';
      const entry = {
        id: clip.id,
        file: `${dir}/${clip.image}`,
        anchor,
        fps: clip.fps,
        loop: clip.loop,
        frames: clip.frames.map((f) => ({ rect: f.rect, pivot: f.pivot })),
      };
      clips.set(clip.id, entry);
      // Idle-v2 ids that collide with suite ids are prefixed.
      const name = sheet === 'idle' && animations.has(clip.id) ? `idle-${clip.id}` : clip.id;
      animations.set(name, { clip: entry, sequence: entry.frames.map((_, i) => i), fps: entry.fps, loop: entry.loop });
    }
    for (const [id, alias] of Object.entries(manifest.animations || {})) {
      const clip = clips.get(alias.clip);
      if (clip) animations.set(id, { clip, sequence: alias.frames, fps: alias.fps ?? clip.fps, loop: alias.loop ?? clip.loop });
    }
  }
  // Desktop-only sequences built from existing frames.
  const breath = animations.get('breath');
  if (breath) {
    animations.set('breath-stand', { clip: breath.clip, sequence: [0, 1, 2, 3, 2, 1], fps: 4, loop: true });
    animations.set('breath-sit', { clip: breath.clip, sequence: [4, 5, 6, 7, 6, 5], fps: 4, loop: true });
  }
  const hang = animations.get('ledge-hang');
  if (hang) animations.set('held', { clip: hang.clip, sequence: hang.sequence, fps: 10, loop: true });
  return { root, animations };
}

class Animator {
  constructor(sprites) {
    this.sprites = sprites;
    this.play('idle');
  }

  play(name, { restart = false, speed = 1 } = {}) {
    this.speed = speed;
    if (this.name === name && !restart) return;
    const anim = this.sprites.animations.get(name) || this.sprites.animations.get('idle');
    this.name = name;
    this.anim = anim;
    this.cursor = 0;
    this.elapsed = 0;
    this.done = false;
  }

  advance(ms) {
    if (this.done) return;
    this.elapsed += ms * this.speed;
    const step = 1000 / this.anim.fps;
    let guard = 0;
    while (this.elapsed >= step && guard++ < 64) {
      this.elapsed -= step;
      if (this.cursor + 1 < this.anim.sequence.length) this.cursor++;
      else if (this.anim.loop) this.cursor = 0;
      else { this.done = true; this.elapsed = 0; break; }
    }
  }

  /** Total duration of a non-looping play, in ms. */
  duration(name = this.name) {
    const a = this.sprites.animations.get(name);
    return a ? (a.sequence.length * 1000) / a.fps : 0;
  }

  frame() {
    const { clip, sequence } = this.anim;
    return { clip, frame: clip.frames[sequence[this.cursor]] };
  }
}

module.exports = { loadSprites, Animator, ASSET_ROOT };
