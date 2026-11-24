import { useEffect, useState } from 'react';
import { HERO_FUR_DEFAULTS, HERO_FUR_VERSION, type HeroFurPreset } from '../heroFurPainter';
import { paintOffThread, paintedObjectUrl } from '../paintWorkerClient';
import './HeroFurSandbox.css';

const ART = `${import.meta.env.BASE_URL}assets/runtime/characters/hero/sleeping/watercolor/v1`;
const SIZES = [{ width: 160, label: '160 px' }, { width: 320, label: '320 px' }, { width: 512, label: '512 px' }] as const;
const STRIP = [0, 1, 2, 3];

type Bake = { url: string; ms: number; offThread: boolean };
// Bounded cache keyed by version, bake size and the full preset; evicted URLs are revoked.
const bakes = new Map<string, Promise<Bake>>();
function bake(preset: HeroFurPreset, size: number) {
  const key = `${HERO_FUR_VERSION}:${size}:${JSON.stringify(preset)}`, hit = bakes.get(key);
  if (hit) { bakes.delete(key); bakes.set(key, hit); return hit; }
  const job = paintOffThread({ kind: 'heroSleeping', preset, size }, { encode: true })
    .then(async result => ({ url: await paintedObjectUrl(result), ms: result.paintMs, offThread: result.offThread }));
  bakes.set(key, job);
  if (bakes.size > 16) { const [oldest, evicted] = bakes.entries().next().value!; bakes.delete(oldest); evicted.then(b => URL.revokeObjectURL(b.url), () => undefined); }
  return job;
}

function usePainted(preset: HeroFurPreset, size: number) {
  const [result, setResult] = useState<Bake | { error: string } | null>(null);
  const key = JSON.stringify(preset);
  useEffect(() => {
    let live = true;
    bake(preset, size).then(b => { if (live) setResult(b); }, (error: Error) => { if (live) setResult({ error: error.message }); });
    return () => { live = false; };
    // The preset is compared by value through its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size]);
  return result;
}

/** The approved cutout and its bobtail layer, registered in the painter's frame (92% width, 17% from the top). */
function Reference() {
  return <div className="hero-fur__frame">
    <img className="hero-fur__reference" src={`${ART}/hero-sleeping-body-v3.png`} alt="Approved sleeping Hero, v3" />
    <img className="hero-fur__reference" src={`${ART}/hero-sleeping-bobtail-layer-v3.png`} alt="" />
  </div>;
}

function Painted({ preset, size }: { preset: HeroFurPreset; size: number }) {
  const result = usePainted(preset, size);
  return <div className="hero-fur__frame">
    {result && 'url' in result ? <img src={result.url} alt={`Procedural sleeping Hero, seed ${preset.seed}`} />
      : <p className="hero-fur__status">{result ? `Bake failed: ${result.error}` : 'Painting…'}</p>}
  </div>;
}

/** Proto review view (`?herosbx`): Hero's approved sleeping curl beside the
 * `hero-fur-study` procedural painting, registered in the same frame, at
 * three display widths, plus a seed strip. Spike tooling only; the game keeps
 * the approved art. */
export function HeroFurSandbox() {
  const [preset, setPreset] = useState<HeroFurPreset>({ ...HERO_FUR_DEFAULTS });
  const [width, setWidth] = useState<number>(320);
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1), size = Math.min(1024, Math.max(256, Math.ceil(width * dpr / 128) * 128));
  const main = usePainted(preset, size);
  const timing = main && 'ms' in main ? `${size}px bake ${main.ms.toFixed(0)} ms ${main.offThread ? 'in a worker' : 'on the UI thread'}.` : '';
  const set = <K extends keyof HeroFurPreset>(key: K, value: HeroFurPreset[K]) => setPreset(current => ({ ...current, [key]: value }));
  const slider = (key: 'clump' | 'brush' | 'light', label: string) => <label>{label}
    <input type="range" min={0} max={1} step={.05} value={preset[key]} onChange={e => set(key, Number(e.target.value))} />
    <output>{preset[key].toFixed(2)}</output>
  </label>;
  return <main className="hero-fur">
    <header className="hero-fur__header">
      <h1>Hero fur study · sleeping curl · {HERO_FUR_VERSION}</h1>
      <button onClick={() => set('seed', Math.max(1, preset.seed - 1))}>Previous seed</button>
      <span>Seed {preset.seed}</span>
      <button onClick={() => set('seed', preset.seed + 1)}>Next seed</button>
      {slider('clump', 'Tongues')}{slider('brush', 'Brush')}{slider('light', 'Light')}
      <label>Width<select value={width} onChange={e => setWidth(Number(e.target.value))}>{SIZES.map(s => <option key={s.width} value={s.width}>{s.label}</option>)}</select></label>
      <button onClick={() => setPreset({ ...HERO_FUR_DEFAULTS })}>Reset</button>
      <a href="proto.html">Proto</a>
    </header>
    <p className="hero-fur__note">Left: the approved ImageGen cutout (body v3 plus its bobtail layer). Right: painted in code from a few lit body parts, markings in body-part coordinates and flame-tongue fur. No reference pixels are read. {timing}</p>
    <div className="hero-fur__body" style={{ ['--hero-fur-w' as string]: `${width}px` }}>
      <section className="hero-fur__pair" aria-label="Side by side">
        <figure><figcaption>Approved · hero-sleeping-body-v3</figcaption><Reference /></figure>
        <figure><figcaption>Procedural · seed {preset.seed}</figcaption><Painted preset={preset} size={size} /></figure>
      </section>
      <section className="hero-fur__strip" aria-label="Seed strip at 160 px">
        {STRIP.map(n => <figure key={n}><figcaption>Seed {preset.seed + n}</figcaption><div className="hero-fur__small"><Painted preset={{ ...preset, seed: preset.seed + n }} size={256} /></div></figure>)}
      </section>
    </div>
  </main>;
}
