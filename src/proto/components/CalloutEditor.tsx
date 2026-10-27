import { EditorTabs, useEditorDrag } from './EditorWorkspace';
import { CalloutCameraFields } from './CameraChoreographyTools';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CalloutEmoji } from './Callout';
import type { CalloutDraft } from './CalloutEditing';
import { HERO_EMOJI_EMOTIONS } from '../heroEmojis';
import { BANKS_EMOJI_EMOTIONS } from '../banksEmojis';
import { MOCHI_EMOJI_EMOTIONS } from '../mochiEmojis';
import { HeroEmoji } from './HeroEmoji';
import { BanksEmoji } from './BanksEmoji';
import { MochiEmoji } from './MochiEmoji';
import { applyCalloutEffect, CALLOUT_EFFECTS, CALLOUT_EFFECT_COLORS, editCalloutText } from '../calloutEffects';
import { calloutPages, letterDelay } from '../calloutPlayback';
export function CalloutExpression({ emoji }: { emoji: CalloutEmoji }) {
  return emoji.actor === 'hero' ? <HeroEmoji emotion={emoji.emotion} /> : emoji.actor === 'banks' ? <BanksEmoji emotion={emoji.emotion} /> : <MochiEmoji emotion={emoji.emotion} />;
}
export function CalloutText({ draft, revealed = draft.text.length }: { draft: CalloutDraft; revealed?: number }) {
  const boundaries = [...new Set([0, draft.text.length, ...draft.marks.flatMap(m => [m.start, m.end])])].sort((a, b) => a - b);
  return <>{boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1], mark = draft.marks.find(m => m.start <= start && m.end >= end);
    let characterIndex = 0;
    // Reserve complete words and the final layout. Invisible letters occupy their final space.
    return <span key={start} style={mark ? { "--fx-color": mark.color, "--fx-potency": mark.potency ?? 1 } as CSSProperties : undefined} className={mark ? `callout-fx callout-fx--${mark.effect}` : undefined}>{draft.text.slice(start, end).split(/(\s+)/).map((word, wordIndex, words) => {
      const offset = start + words.slice(0, wordIndex).join('').length;
      let cursor = offset;
      return <span key={wordIndex} className={/\s/.test(word) ? undefined : 'callout-word'}>{Array.from(word).map(letter => {
        const index = cursor; cursor += letter.length;
        const wave = mark?.effect === 'wave' && !/\s/.test(letter);
        const delay = characterIndex++ * 65;
        return <span key={index} className={wave ? 'callout-wave-character' : undefined} style={{visibility: index < revealed ? undefined : 'hidden', animationDelay: wave ? `${delay}ms` : undefined}}>{letter}</span>;
      })}</span>;
    })}</span>;
  })}</>;
}
function DraftPreview({ draft, speaker, tone }: { draft: CalloutDraft; speaker?: string; tone?: string }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [replay, setReplay] = useState(0);
  const pages = calloutPages(draft.text);
  const index = Math.min(pageIndex, pages.length - 1), page = pages[index];
  const pageText = draft.text.slice(page.start, page.end);
  useEffect(() => { setPageIndex(0); setRevealed(null); setReplay(0); }, [draft.text]);
  useEffect(() => {
    if (!replay) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || draft.letterMs === 0) { setRevealed(null); return; }
    let frame = 0, previous = performance.now(), elapsed = 0, count = 0;
    setRevealed(0);
    const tick = (now: number) => {
      elapsed += Math.min(now - previous, 100); previous = now;
      while (count < pageText.length) {
        const delay = letterDelay(draft.text, page.start + count, draft.marks, draft.letterMs ?? 32);
        if (elapsed < delay) break;
        elapsed -= delay;
        count += (pageText.codePointAt(count) ?? 0) > 0xffff ? 2 : 1;
      }
      setRevealed(count);
      if (count < pageText.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [replay, index, draft.text, draft.marks, draft.letterMs]);
  const previewDraft = { ...draft, text: pageText, marks: draft.marks.flatMap(mark => mark.end > page.start && mark.start < page.end ? [{ ...mark, start: Math.max(0, mark.start-page.start), end: Math.min(pageText.length, mark.end-page.start) }] : []) };
  const next = () => { setReplay(0); if (revealed !== null && revealed < pageText.length) setRevealed(null); else { setPageIndex((index+1)%pages.length); setRevealed(null); } };
  return <section className="callout-draft-preview" aria-label="Unsaved callout preview">
    <header><h3>Live preview</h3><button type="button" onClick={() => setReplay(value=>value+1)}>Replay reveal</button></header>
    <div className="callout-draft-preview__stage">
      <div className="proto-callout callout-draft-preview__bubble" data-expression={Boolean(draft.emoji)} data-tone={tone}>
        <div className="proto-callout-content">
          {draft.emoji && <div className="proto-callout-expression" aria-hidden="true"><CalloutExpression emoji={draft.emoji} /></div>}
          <div className="proto-callout-copy">{speaker && <strong>{speaker}</strong>}<span className="proto-callout-text"><CalloutText draft={previewDraft} revealed={revealed ?? pageText.length} /></span></div>
          {pages.length>1 && <span className="proto-callout-page">({index+1}/{pages.length})</span>}
          <button type="button" className="proto-callout-next" aria-label="Advance preview" onClick={next}><span aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></button>
        </div>
      </div>
    </div>
    <nav aria-label="Preview bubbles"><button type="button" disabled={index===0} onClick={()=>{setReplay(0);setPageIndex(index-1);setRevealed(null);}}>Previous bubble</button><span>Bubble {index+1} of {pages.length}</span><button type="button" disabled={index===pages.length-1} onClick={()=>{setReplay(0);setPageIndex(index+1);setRevealed(null);}}>Next bubble</button></nav>
    <small>Unsaved draft · text, expression and effects update as you edit.</small>
  </section>;
}
export function CalloutEditor({ authoringId, source, initial, speaker, tone, onSave, onReset, onClose }: { authoringId?: string; source?: { current: HTMLElement | null }; initial: CalloutDraft; speaker?: string; tone?: string; onSave: (draft: CalloutDraft) => void | Promise<void>; onReset: () => void | Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(initial), [selection, setSelection] = useState([0, 0]), [error, setError] = useState('');
  const [section, setSection] = useState('Text & effects');
  const floating = useEditorDrag(source);
  const dialog = useRef<HTMLDialogElement>(null), text = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; dialog.current?.showModal(); return () => { dialog.current?.close(); if (previous?.isConnected) previous.focus(); }; }, []);
  const rememberSelection = () => { if (text.current) setSelection([text.current.selectionStart, text.current.selectionEnd]); };
  const [saving, setSaving] = useState(false);
  const commit = async (action: () => void | Promise<void>) => { setSaving(true); try { await action(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save to disk. Your draft is still open; try again.'); } finally { setSaving(false); } };
  const actor = draft.emoji?.actor ?? 'hero';
  const emotions = actor === 'hero' ? HERO_EMOJI_EMOTIONS : actor === 'banks' ? BANKS_EMOJI_EMOTIONS : MOCHI_EMOJI_EMOTIONS;
  const selectedMark = draft.marks.find(m => m.start <= selection[0] && m.end >= selection[1] && selection[1] > selection[0]);
  const tune = (settings: { color?: string; potency?: number }) => {
    if (!selectedMark) return;
    setDraft(d => ({ ...d, marks: applyCalloutEffect(d.marks, selection[0], selection[1], selectedMark.effect, { color: selectedMark.color, potency: selectedMark.potency, ...settings }) }));
  };
  const apply = (effect?: typeof CALLOUT_EFFECTS[number]) => {
    setDraft(d => ({ ...d, marks: applyCalloutEffect(d.marks, selection[0], selection[1], effect) }));
    text.current?.focus(); text.current?.setSelectionRange(selection[0], selection[1]);
  };
  return <dialog ref={node => { dialog.current = node; floating.ref.current = node; }} style={floating.style} data-camera-ignore="true" onWheel={e => e.stopPropagation()} onClick={e => e.stopPropagation()} className="callout-editor" data-editor-safe="true" aria-labelledby="callout-editor-title" onCancel={e => { e.preventDefault(); onClose(); }} onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <header className="editor-drag-handle" {...floating.handle}><h2 id="callout-editor-title">Edit callout{authoringId && <span className="callout-editor-id"> · {authoringId}</span>}</h2><button type="button" onClick={onClose} aria-label="Close callout editor">×</button></header>
    <footer className="editor-command-bar"><button type="button" disabled={saving} onClick={() => commit(onReset)}>Restore original</button><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={saving || !draft.text.trim()} onClick={() => commit(() => onSave(draft))}>Save callout</button></footer>
    <EditorTabs names={['Text & effects', 'Expression', 'Camera', 'Preview']} value={section} onChange={setSection} label="Callout sections" />
    <div className="editor-section" hidden={section !== 'Expression'}>
    <p>Choose an expression, then select words in the text to give them an effect.</p>
    <fieldset><legend>Emoji</legend><div className="callout-emoji-picker">
      <button type="button" aria-pressed={!draft.emoji} onClick={() => setDraft({ ...draft, emoji: undefined })}>None</button>
      {emotions.map(emotion => { const emoji = { actor, emotion } as CalloutEmoji; return <button type="button" key={emotion} aria-label={emotion} title={emotion} aria-pressed={draft.emoji?.emotion === emotion} onClick={() => setDraft({ ...draft, emoji })}><CalloutExpression emoji={emoji} /><span>{emotion}</span></button>; })}
    </div></fieldset>
    </div><div className="editor-section" hidden={section !== 'Text & effects'}>
    <label htmlFor="callout-editor-text">Callout text</label>
    <textarea ref={text} id="callout-editor-text" maxLength={2000} rows={5} value={draft.text} onKeyUp={rememberSelection} onPointerUp={rememberSelection} onSelect={e => setSelection([e.currentTarget.selectionStart, e.currentTarget.selectionEnd])} onChange={e => { const value = e.target.value; setDraft(d => ({ ...d, text: value, marks: editCalloutText(d.text, value, d.marks) })); }} />
    <p>Separate bubbles with a blank line. Longer paragraphs also split automatically at sentence or word boundaries.</p>
    <label>Reveal speed (milliseconds per letter; 0 is instant) <input type="number" min={0} max={200} value={draft.letterMs ?? 32} onChange={e => setDraft({...draft, letterMs: Math.max(0, Math.min(200, Number(e.target.value)))})} /></label>
    <div className="callout-effects" role="group" aria-label="Word effects">{[...CALLOUT_EFFECTS, 'clear' as const].map(effect => <button type="button" key={effect} disabled={selection[0] === selection[1]} onClick={() => apply(effect === 'clear' ? undefined : effect)}>{effect === 'clear' ? 'Clear effect' : effect[0].toUpperCase() + effect.slice(1)}</button>)}</div>
    <small>{selection[1] > selection[0] ? `Selected: “${draft.text.slice(...selection as [number, number])}”` : 'Select a word or phrase to enable effects. Applying another effect replaces its previous effect.'}</small>
    {selectedMark && <fieldset className="callout-effect-settings"><legend>Effect settings</legend>
      <label>Effect color <input type="color" value={selectedMark.color ?? CALLOUT_EFFECT_COLORS[selectedMark.effect]} onChange={e => tune({ color: e.target.value })} /></label>
      <label>Effect potency <input type="range" aria-label="Effect potency" min="0" max="2" step="0.05" value={selectedMark.potency ?? 1} onChange={e => tune({ potency: Number(e.target.value) })} /><output>{Math.round((selectedMark.potency ?? 1) * 100)}%</output></label>
      <small>{({ emphasis: 'Controls boldness.', shake: 'Controls shake distance.', wave: 'Controls wave height.', glow: 'Controls glow radius.', whisper: 'Controls softness and fading.', rainbow: 'Controls rainbow saturation; color sets the starting hue.' })[selectedMark.effect]}</small>
    </fieldset>}
    </div><div className="editor-section" hidden={section !== 'Camera'}>
    {authoringId && <p>Callout trigger ID: <code>{authoringId}</code></p>}
    <CalloutCameraFields value={draft.camera} onChange={camera => setDraft({ ...draft, camera })} />
    </div><div className="editor-section" hidden={section !== 'Preview'}>
    <p>Preview each bubble below, or replay its reveal at the selected speed. Camera framing is applied in the scene when the saved callout plays.</p>
    <p>Save callout writes permanent project data shared by every testing device.</p>
    </div><DraftPreview draft={draft} speaker={speaker} tone={tone} />{error && <p role="alert">{error}</p>}

  </dialog>;
}

