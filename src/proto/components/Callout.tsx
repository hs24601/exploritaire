import { gameTime } from '../../gameTime';
import { claimActorExpression } from '../actorExpression';
import type { CalloutMark } from '../calloutEffects';
import { calloutReference } from '../calloutReferences';
import type { CalloutCamera } from '../cameraChoreography';
import { getCameraLibrary, getCameraPlayback, playCalloutCamera } from '../cameraDirector';
import { memo, useState, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HeroEmoji } from './HeroEmoji';
import { MochiEmoji } from './MochiEmoji';
import { BanksEmoji } from './BanksEmoji';
import type { HeroEmojiEmotion } from '../heroEmojis';
import type { MochiEmojiEmotion } from '../mochiEmojis';
import type { BanksEmojiEmotion } from '../banksEmojis';
import './callout.css';
import { useCalloutEditing } from './CalloutEditing';
import { CalloutEditor, CalloutText } from './CalloutEditor';
import { calloutPages, letterDelay, placeCallout, type CalloutRect } from '../calloutPlayback';
import { sceneActorBoxes } from '../sceneProjection';
const EMPTY_MARKS: CalloutMark[] = [];

export type CalloutEmoji =
  | { actor: 'hero'; emotion: HeroEmojiEmotion }
  | { actor: 'mochi'; emotion: MochiEmojiEmotion }
  | { actor: 'banks'; emotion: BanksEmojiEmotion };
export type CalloutPoint = { x: number; y: number };
/** Points use viewport CSS pixels. Return null to hide an unavailable/concealed anchor. */
export type CalloutAnchor = CalloutPoint | (() => CalloutPoint | null);
export interface CalloutProps {
  /** Overlay stacking layer; callers hosting a cinema can lift its dialogue. */
  layer?: number;
  choices?: {label:string; onSelect:()=>void}[];
  text: string;
  marks?: CalloutMark[];
  /** Authored default, superseded by local edits and matching custom triggers. */
  camera?: CalloutCamera;
  /** Conceal the opening bubble until its first camera action settles. */
  waitForFirstCamera?: boolean;
  /** Zero-based bubble camera cues, fired only when the reader reaches that bubble. */
  bubbleCameras?: Record<number, CalloutCamera>;
  onBubbleChange?: (index: number) => void;
  /** Stable authoring identity for locally saved dialogue. */
  authoringId?: string;
  speaker?: string;
  alignment?: 'center' | 'after';
  /** Short combat reactions stay attached to their foundation instead of searching the scene. */
  placement?: 'free' | 'foundation';
  emoji?: CalloutEmoji;
  /** Compact expression-only reaction with accessible dialogue retained. */
  emojiOnly?: boolean;
  /** Let the speaking actor share the resolved (possibly edited) expression. */
  syncActorExpression?: boolean;
  anchor: CalloutAnchor;
  /** Optional scene adapter; defaults to the map/combat actor DOM bounds. */
  avoidActors?: () => CalloutRect[];
  /** Milliseconds per letter; zero reveals instantly. */
  letterMs?: number;
  paused?: boolean;
  onComplete?: () => void;
  visible?: boolean;
  /** Change this key to restart the lifetime and entrance animation. */
  instanceKey?: string | number;
  /** Zero keeps the callout visible until dismissed by its owner. */
  durationMs?: number;
  onDismiss?: () => void;
  tone?: 'dialogue' | 'gold' | 'warning';
  /** Custom decorative expression for actors without an atlas. */
  expression?: ReactNode;
}

/** Presentation only: callers own gameplay triggers, pause policy and visibility gates. */
export const Callout = memo(function Callout({ visible = true, ...props }: CalloutProps) {
  if (!visible || typeof document === 'undefined') return null;
  return createPortal(<CalloutBody key={props.instanceKey} {...props} />, document.body);
});

function CalloutBody({ text, speaker, emoji, emojiOnly = false, syncActorExpression, authoringId, instanceKey, anchor, durationMs = 5000, onDismiss, layer = 120,
  choices, tone = 'dialogue', expression, camera, waitForFirstCamera = false, bubbleCameras, marks = EMPTY_MARKS, alignment = 'center', placement = 'free', avoidActors, letterMs = 32, paused = false, onComplete, onBubbleChange }: Omit<CalloutProps, 'visible'>) {
  const editing = useCalloutEditing();
  const [editorVisible, setEditorVisible] = useState(false);
  const id = authoringId ?? `${speaker ?? 'dialogue'}:${instanceKey ?? text}`;
  const draft = editing.edits[id] ?? { text, emoji, marks, camera, letterMs };
  // The editor also saves inherited camera settings when only text/emoji changes.
  // Those copies must retain the authored per-bubble camera sequence.
  const customCamera = Boolean(editing.edits[id]?.camera && JSON.stringify(editing.edits[id].camera) !== JSON.stringify(camera));
  const pages = calloutPages(draft.text);
  const [pageIndex, setPageIndex] = useState(0), [revealed, setRevealed] = useState(0), [finished, setFinished] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useLayoutEffect(() => { setPageIndex(0); setRevealed(0); setFinished(false); }, [id, draft.text]);
  const bubbleCallback=useRef(onBubbleChange); bubbleCallback.current=onBubbleChange;
  useEffect(()=>{if(!finished && !(editing.enabled || editorVisible))bubbleCallback.current?.(pageIndex);},[pageIndex,finished,(editing.enabled || editorVisible)]);
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const pageText = draft.text.slice(page.start, page.end);
  const speed = draft.letterMs ?? letterMs;
  const count = reduced || (editing.enabled || editorVisible) || speed === 0 ? pageText.length : Math.max(waitForFirstCamera ? [...pageText][0]?.length ?? 0 : 0, revealed);
  const ready = count >= pageText.length;
  const active = useRef(false);
  const firstCameraStarted = useRef(false);
  const firstCameraSettled = useRef(false);
  useEffect(() => {
    if (ready || paused || editorVisible || finished) return;
    let frame = 0, last = gameTime.now(), elapsed = 0;
    let next = revealed;
    const tick = (now: number) => {
      if (!document.hidden && active.current) {
        elapsed += Math.min(now - last, 100);
        while (next < pageText.length) {
          const delay = letterDelay(draft.text, page.start + next, draft.marks, speed);
          if (elapsed < delay) break;
          elapsed -= delay;
          // A complete code point per step avoids half an emoji/surrogate.
          next += (pageText.codePointAt(next) ?? 0) > 0xffff ? 2 : 1;
        }
        setRevealed(next);
      }
      last = now;
      if (next < pageText.length) frame = gameTime.requestAnimationFrame(tick);
    };
    frame = gameTime.requestAnimationFrame(tick);
    return () => gameTime.cancelAnimationFrame(frame);
  }, [page.start, page.end, ready, paused, editorVisible, finished, speed, draft.text, draft.marks]);
  const advance = () => {
    if (paused || (editing.enabled || editorVisible) || finished) return;
    if (!ready) { setRevealed(pageText.length); return; }
    if (pageIndex < pages.length - 1) { setRevealed(0); setPageIndex(i => i + 1); return; }
    if(choices?.length)return;
    setFinished(true); onComplete?.(); onDismiss?.();
  };
  emoji = draft.emoji;
  useLayoutEffect(() => {
    if (syncActorExpression && !finished && draft.emoji?.actor === 'hero') {
      return claimActorExpression('hero', draft.emoji.emotion);
    }
  }, [syncActorExpression, finished, draft.emoji?.actor, draft.emoji?.emotion]);
  const root = useRef<HTMLDivElement>(null);
  
  const cameraFired = useRef(new Set<number>());
  const cameraDraft = useRef(draft); cameraDraft.current = draft;
  useEffect(() => {
    if ((editing.enabled || editorVisible) || finished || paused || cameraFired.current.has(pageIndex)) return;
    // Local callout/trigger overrides own the complete reading sequence.
    if (pageIndex > 0 && (customCamera || !bubbleCameras?.[pageIndex] || getCameraLibrary().some(c => c.enabled && c.trigger.event === 'callout' && (!c.trigger.value || c.trigger.value === id)))) return;
    let frame = 0;
    const trigger = () => {
      // The caller gates story/discovery; a shot must also be able to bring an offscreen speaker into view.
      if (!getCameraPlayback().available) { frame = gameTime.requestAnimationFrame(trigger); return; }
      cameraFired.current.add(pageIndex);
      playCalloutCamera(id, pageIndex === 0 ? cameraDraft.current.camera : bubbleCameras?.[pageIndex], pageIndex > 0 || (!customCamera && Boolean(camera)));
      if (pageIndex === 0) firstCameraStarted.current = true;
    };
    frame = gameTime.requestAnimationFrame(trigger);
    return () => gameTime.cancelAnimationFrame(frame);
  }, [id, (editing.enabled || editorVisible), pageIndex, finished, paused, bubbleCameras, customCamera, camera]);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (!(durationMs > 0) || (editing.enabled || editorVisible) || !ready || paused || pages.length > 1 || finished) return;
    const timer = gameTime.setTimeout(() => dismiss.current?.(), durationMs);
    return () => gameTime.clearTimeout(timer);
  }, [durationMs, (editing.enabled || editorVisible), ready, paused, pages.length, finished]);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    let previous = '';
    // Bubble metrics change with text reveal and paging, not with the camera:
    // measure them on resize so the per-frame placement reads no layout.
    let size = { w: 0, h: 0, bubbleOffset: 0, bubbleWidth: 0 };
    const measure = () => {
      const bubble = element.firstElementChild as HTMLElement;
      size = { w: element.offsetWidth, h: element.offsetHeight, bubbleOffset: bubble.offsetLeft, bubbleWidth: bubble.offsetWidth };
    };
    const hide = () => {
      if (element.style.visibility !== 'hidden') element.style.visibility = 'hidden';
      active.current = false; previous = '';
    };
    const domActors = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter(node => !node.hidden && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none')
      .map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    const place = () => {
      if (waitForFirstCamera && !firstCameraSettled.current && !(editing.enabled || editorVisible)) {
        const playback = getCameraPlayback();
        if (!firstCameraStarted.current || !playback.available || playback.moving || playback.paused) { hide(); return; }
        // Later bubble cameras must not conceal dialogue again.
        firstCameraSettled.current = true;
      }
      const point = typeof anchor === 'function' ? anchor() : anchor;
      const valid = point && Number.isFinite(point.x) && Number.isFinite(point.y);
      if (!valid) { hide(); return; }
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const { w, h, bubbleOffset, bubbleWidth } = size;
      // Live map actors come from the camera projection; den interiors and
      // cinema targets are rare enough to measure directly.
      const projected = sceneActorBoxes();
      // Any map actor the projection does not cover is measured directly.
      const unprojected = projected ? projected.map(actor => `:not([data-actor-id="${CSS.escape(actor.id)}"])`).join('') : '';
      const actors = avoidActors?.() ?? (projected
        ? [...projected.map(actor => actor.box), ...domActors(`.proto-map [data-board-piece="actor"]${unprojected}, .proto-map [data-interior-actor], .banks-rescue-cinema [data-scene-target]`)]
        : domActors('.proto-map [data-board-piece="actor"], .proto-map [data-interior-actor], .banks-rescue-cinema [data-scene-target]'));
      const position = placement==='foundation'
        ? {x:Math.max(left+12,Math.min(left+width-w-12,point.x-w/2)),y:point.y-h-12,below:false,side:false}
        : placeCallout(point, w, h, {left, top, right: left + width, bottom: top + height}, actors, alignment === 'after');
      if (!position) { hide(); return; }
      const {x, y, below, side} = position;
      if (element.style.visibility !== 'visible') element.style.visibility = 'visible';
      active.current = true;
      const tail = Math.max(22, Math.min(point.x - x - bubbleOffset, bubbleWidth - 22));
      const next = `${x},${y},${tail},${below},${side}`;
      if (next === previous) return;
      previous = next;
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.setProperty('--callout-tail', `${tail}px`);
      element.dataset.below = String(below);
      element.dataset.side = String(side);
    };
    const tick = () => { place(); frame = gameTime.requestAnimationFrame(tick); };
    measure(); place();
    // Actors/cameras may move even for a static anchor; placement never sets React state.
    frame = gameTime.requestAnimationFrame(tick);
    const observer = new ResizeObserver(() => { measure(); place(); });
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      gameTime.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [anchor, alignment, placement, avoidActors, finished]);

  if (finished) return null;
  return <><div ref={root} className="proto-callout" data-placement={placement} data-emoji-only={emojiOnly} data-expression={Boolean(expression || emoji)} data-callout-id={id} data-callout-reference={calloutReference(id)} data-tone={tone} data-page={pageIndex + 1} data-pages={pages.length} data-revealing={!ready} style={{ visibility: 'hidden', zIndex: layer }}>
    <div className="proto-callout-content">
      <button type="button" className="proto-callout-advance" disabled={paused || (editing.enabled || editorVisible)} aria-label={`${speaker ? speaker + ': ' : ''}${pageText} — ${!ready ? 'Reveal text' : pageIndex < pages.length - 1 ? 'Next bubble' : onComplete ? 'Continue' : 'Close dialogue'}`} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); advance(); }} />
      {(expression || emoji) && <div className="proto-callout-expression" aria-hidden="true">
        {expression ?? (emoji?.actor === 'hero' ? <HeroEmoji emotion={emoji.emotion} />
          : emoji?.actor === 'mochi' ? <MochiEmoji emotion={emoji.emotion} />
            : emoji?.actor === 'banks' ? <BanksEmoji emotion={emoji.emotion} /> : null)}
      </div>}
      <div className="proto-callout-copy">{speaker && <strong>{speaker}</strong>}<span className="proto-callout-text" aria-hidden="true"><CalloutText draft={{...draft, text: pageText, marks: draft.marks.flatMap(m => m.end > page.start && m.start < page.end ? [{...m, start: Math.max(0, m.start - page.start), end: Math.min(pageText.length, m.end - page.start)}] : [])}} revealed={count} /></span>

        <span className="proto-callout-accessible" role="status" aria-live="polite" aria-atomic="true">{speaker ? speaker + ': ' : ''}{pageText}</span>
      </div>
      {pages.length > 1 && <span className="proto-callout-page" aria-label={`Bubble ${pageIndex + 1} of ${pages.length}`}>({pageIndex + 1}/{pages.length})</span>}
      {ready && pageIndex===pages.length-1 && choices?.length ? <div className="proto-callout-choices" role="group" aria-label="Choose what Hero does">{choices.map(choice=><button key={choice.label} type="button" disabled={paused || (editing.enabled || editorVisible)} onClick={e=>{e.stopPropagation();choice.onSelect();}}>{choice.label}</button>)}</div> : <button type="button" className="proto-callout-next" disabled={paused || (editing.enabled || editorVisible)} aria-label={!ready ? 'Reveal text' : pageIndex < pages.length - 1 ? 'Next bubble' : onComplete ? 'Continue' : 'Close dialogue'} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); advance(); }}>
        <span aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
      </button>
      }
      {import.meta.env.DEV && !emojiOnly && <button type="button" className="proto-callout-edit" data-editor-safe="true" aria-label="Edit callout" title="Edit callout" onClick={() => setEditorVisible(true)}>✎</button>}
    </div>
    {import.meta.env.DEV && editing.enabled && <div className="proto-callout-dev" aria-label="Callout configuration reference">Dev · Dialog {calloutReference(id)}{calloutReference(id) !== id ? ` · ${id}` : ''} · bubble {pageIndex + 1}/{pages.length}</div>}
  </div>{import.meta.env.DEV && editorVisible && <CalloutEditor source={root} authoringId={id} initial={draft} speaker={speaker} tone={tone} onClose={() => setEditorVisible(false)} onSave={value => editing.save(id, value)} onReset={() => editing.save(id, null)} />}</>;
}

