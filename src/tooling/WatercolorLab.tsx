import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createTableauGroundCover } from '../proto/tableauGroundCover';
import { BIOME_CARD_RECIPES, loadBiomeCardBackground } from '../proto/biomeCardArt';
import { DEFAULT_WASH, WASH_CONTROLS } from '../proto/watercolorWash';
import { DAB_CONTROLS, DEFAULT_DABS, type RadialDabPreset } from '../proto/radialDabs';
import { DEFAULT_PAINT, isRadialDabPreset, parsePaintPreset, type PaintPreset } from '../proto/watercolorPaint';
import './WatercolorLab.css';

const labels = { load: 'Pigment load', water: 'Water clearing', rim: 'Pooled edges', granulation: 'Sediment', roughness: 'Edge irregularity', opacity: 'Wash opacity' };
const draftKey = 'exploritaire.watercolor-lab.draft.v2';
function initialPreset() { try { return parsePaintPreset(JSON.parse(localStorage.getItem(draftKey) ?? 'null')); } catch { return { ...DEFAULT_PAINT }; } }
function download(name: string, href: string) { const link = document.createElement('a'); link.download = name; link.href = href; link.click(); }
function groundPreview(palette: 'dirt' | 'woodland', preset: PaintPreset | false) {
  const root = new THREE.Group(), cover = createTableauGroundCover(root, false, palette, preset);
  try { const first = root.children[0].children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>; return (first.material.map!.image as HTMLCanvasElement).toDataURL(); }
  finally { cover.dispose(); }
}
export function WatercolorLab() {
  const [preset, setPreset] = useState<PaintPreset>(initialPreset);
  const drafts = useRef<{ radial: PaintPreset; pigment: PaintPreset }>({ radial: DEFAULT_DABS, pigment: DEFAULT_WASH });
  const radial = isRadialDabPreset(preset);
  const method = radial ? 'radial' : 'pigment';
  const presetFile = radial ? 'radialDabPresets.json' : 'watercolorPresets.json';
  const [palette, setPalette] = useState<'dirt' | 'woodland'>('woodland');
  const [kind, setKind] = useState('berry-patch-sparse'), [view, setView] = useState(3);
  const [ground, setGround] = useState<string[]>([]), [cards, setCards] = useState<string[]>([]);
  const [backdrop, setBackdrop] = useState('checker'), [status, setStatus] = useState('Preparing paint…'), [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true; setBusy(true);
    const timer = window.setTimeout(async () => {
      const started = performance.now();
      try {
        const nextGround = [groundPreview(palette, false), groundPreview(palette, preset)];
        const nextCards = await Promise.all([loadBiomeCardBackground(kind, 'paint', view, false), loadBiomeCardBackground(kind, 'paint', view, preset)]);
        if (!active) return;
        if (nextCards.some(c => !c.src)) throw new Error('Card artwork unavailable; check asset loading.');
        setGround(nextGround); setCards(nextCards.map(c => c.src!)); setError('');
        setStatus(`Ready · ${Math.round(performance.now() - started)} ms including asset loading. Static textures; drafts stay in this lab.`);
        try { localStorage.setItem(draftKey, JSON.stringify(preset)); } catch { /* Export remains available if browser storage is full. */ }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Unable to prepare watercolor preview.'); }
      finally { if (active) setBusy(false); }
    }, 100);
    return () => { active = false; window.clearTimeout(timer); };
  }, [preset, palette, kind, view]);
  return <main className="watercolor-lab">
    <header><div><h1>Watercolor lab</h1><p>Ground washes &amp; biome cards · original / tuned</p></div><a href={`${import.meta.env.BASE_URL}tools/bush-lab.html`}>Bush prototype</a><a href={`${import.meta.env.BASE_URL}tooling.html`}>Tile tooling</a><a href={`${import.meta.env.BASE_URL}proto.html?scene=day01.khad-roots-exposed`}>Playtest</a></header>
    <aside aria-label="Watercolor controls">
      <h2>Paint settings</h2>
      <label>Paint method<select aria-label="Paint method" value={method} onChange={e => { drafts.current[method] = preset; setPreset(drafts.current[e.target.value as typeof method]); }}><option value="radial">Radial dabs · default</option><option value="pigment">Pigment pools · experimental</option></select></label>
      <label>Seed{radial ? <input aria-label="Seed" type="number" min={0} max={4294967295} step={1} value={preset.seed} onChange={e => { const seed = Number(e.target.value); if (Number.isInteger(seed) && seed >= 0 && seed <= 4294967295) setPreset({ ...preset, seed }); }} /> : <input aria-label="Seed" value={preset.seed} maxLength={96} onChange={e => setPreset({ ...preset, seed: e.target.value || DEFAULT_WASH.seed })} />}</label>
      <label>Ground palette<select aria-label="Ground palette" value={palette} onChange={e => setPalette(e.target.value as typeof palette)}><option value="woodland">Woodland · olive / earth</option><option value="dirt">Den · umber / ochre</option></select></label>
      <label>Card biome<select aria-label="Card biome" value={kind} onChange={e => setKind(e.target.value)}>{Object.keys(BIOME_CARD_RECIPES).map(k => <option key={k}>{k}</option>)}</select></label>
      <label>Card view <output>{view + 1} / 12</output><input aria-label="Card view" type="range" min={0} max={11} step={1} value={view} onChange={e => setView(Number(e.target.value))} /></label>
      {radial ? <>
        {(Object.keys(DAB_CONTROLS) as (keyof typeof DAB_CONTROLS)[]).map(key => { const control = DAB_CONTROLS[key]; return <label key={key}>{control.label} <output>{control.step === 1 ? preset[key] : preset[key].toFixed(2)}</output><input aria-label={control.label} type="range" min={control.min} max={control.max} step={control.step} value={preset[key]} onChange={e => { const next: RadialDabPreset = { ...preset, [key]: Number(e.target.value) }; if (key === 'minRadius') next.maxRadius = Math.max(next.minRadius, next.maxRadius); if (key === 'maxRadius') next.minRadius = Math.min(next.maxRadius, next.minRadius); setPreset(next); }} /></label>; })}
        {(['Base pigment', 'Earth pigment'] as const).map((label, i) => <label key={label}>{label} · {palette}<input aria-label={label} type="color" value={preset.colors[palette][i]} onChange={e => { const pair: [string, string] = [...preset.colors[palette]]; pair[i] = e.target.value; setPreset({ ...preset, colors: { ...preset.colors, [palette]: pair } }); }} /></label>)}
      </> : WASH_CONTROLS.map(key => <label key={key}>{labels[key]} <output>{preset[key].toFixed(2)}</output><input aria-label={labels[key]} type="range" min={0} max={1} step={.01} value={preset[key]} onChange={e => setPreset({ ...preset, [key]: Number(e.target.value) })} /></label>)}
      <div className="watercolor-lab__commands">
        <button onClick={() => setPreset(radial ? { ...DEFAULT_DABS } : { ...DEFAULT_WASH })}>Reset paint</button>
        <button onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(preset, null, 2) + '\n'], { type: 'application/json' })); download(presetFile, url); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Export preset</button>
        <label className="watercolor-lab__import">Import preset<input aria-label="Import preset" type="file" accept=".json,application/json" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; try { if (file.size > 8192) throw new Error('Preset exceeds 8 KB.'); setPreset(parsePaintPreset(JSON.parse(await file.text()))); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid preset.'); } }} /></label>
        <button disabled={busy || !ground[1]} onClick={() => download(`ground-${palette}.png`, ground[1])}>Export ground PNG</button>
        <button disabled={busy || !cards[1]} onClick={() => download(`card-${kind}-${view + 1}.png`, cards[1])}>Export card PNG</button>
      </div>
      <p>Exported paint can replace <code>src/data/{presetFile}</code> after review. Drafts stay in this lab. Palette edits affect the selected ground palette and matching card biomes.</p>
    </aside>
    <section className="watercolor-lab__preview" aria-label="Paint comparison" aria-busy={busy}>
      <div className="watercolor-lab__group"><div className="watercolor-lab__preview-heading"><h2>Ground atlas</h2><label>Preview ground<select value={backdrop} onChange={e => setBackdrop(e.target.value)}><option value="checker">Transparency</option><option value="light">Light paper</option><option value="dark">Game dark</option></select></label></div>
      <div className={`watercolor-lab__pair watercolor-lab__ground watercolor-lab__ground--${backdrop}`}>{ground.map((src, i) => <figure key={i}><img src={src} alt={`${i ? 'Tuned' : 'Original'} ${palette} ground atlas`} /><figcaption>{i ? `Tuned · ${radial ? 'radial dabs' : 'pigment pools'}` : 'Original · fixed radial dabs'}</figcaption></figure>)}</div>
      </div><div className="watercolor-lab__group"><h2>Actual card composition</h2><div className="watercolor-lab__pair watercolor-lab__cards">{cards.map((src, i) => <figure key={i}><img src={src} alt={`${i ? 'Tuned' : 'Original'} ${kind} card background`} /><figcaption>{i ? 'Tuned · paint beneath scenery' : 'Original · approved asset composition'}</figcaption></figure>)}</div></div>
    </section>
    <footer><p role="status">{busy ? 'Preparing paint…' : status}</p>{error && <p role="alert">{error}</p>}</footer>
  </main>;
}
