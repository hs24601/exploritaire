import './stellarCombat.css';
import { mountGridTableau, type GridCard, type GridRender } from '../book/gridTableau.js';
import { currentFxQuality, fxPreference, setFxPreference, startFxGovernor, type FxPreference } from '../proto/fxQuality';
import { heroEmojiImage } from '../proto/heroEmojis';
import { createSkyRenderer } from './skyRenderer';
import { StellarAudio } from './stellarAudio';
import { createStellarBattle, stellarDraw, stellarReceipt, stellarStuck, type StellarBattle } from './stellarRules';
import {createWorldRailAutoPlay} from '../book/worldRailAutoPlay';
import {isTextEditingTarget} from '../proto/keyboardInput';
import { constellationName, pickHome, sizeClass, type Rect } from './stellarSky';

/** portals.html?stellarcombat: the packed 3x3 grid tableau, played to the night sky.
 * The grid engine owns the deal, legality, backfill and stock; this page turns
 * its receipts into stars, constellations and sound, without a combat opponent. */
const MUTE_KEY = 'exploritaire-stellar-muted';
const SOUND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, html?: string) => {
  const node = document.createElement(tag); if (className) node.className = className; if (html) node.innerHTML = html; return node;
};
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export function startStellarCombat() {
  document.title = 'Stellar Combat · Exploritaire';
  const font = el('link'); font.rel = 'stylesheet'; font.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap'; document.head.append(font);
  document.documentElement.dataset.bookBoot = 'ready';

  const root = el('main', 'stellar'); root.setAttribute('aria-label', 'Stellar combat'); root.dataset.phase = 'pick';
  const canvas = el('canvas', 'stellar-sky'); canvas.setAttribute('aria-hidden', 'true');
  const chart = el('div', 'stellar-chart'), chainText = el('p', 'stellar-chain'); chainText.setAttribute('aria-live', 'polite');
  const heroBox = el('section', 'stellar-hero'); heroBox.setAttribute('aria-label', 'Hero');
  const portrait = el('div', 'stellar-hero-portrait'), heroImg = el('img'); heroImg.alt = 'Hero'; heroImg.src = heroEmojiImage('happy'); portrait.append(heroImg);
  const heroLabel = el('div', 'stellar-hero-label');
  heroLabel.append(el('strong', '', 'Hero')); heroBox.append(portrait, heroLabel);
  const stage = el('div', 'stellar-stage'), board = el('div', 'stellar-board'); stage.append(board);
  const controls = el('div', 'stellar-controls');
  const soundButton = el('button', 'stellar-button stellar-icon'), qualityButton = el('button', 'stellar-button');
  const autoButton=el('button','stellar-button stellar-icon','▷'),restartButton=el('button','stellar-button','New night');
  autoButton.type=restartButton.type=soundButton.type=qualityButton.type='button';controls.append(autoButton,restartButton,qualityButton,soundButton);
  // ?fullgrid keeps the whole field in play; the reach toggle compares the ring around the foundation with the whole field.
  const fullGrid=new URLSearchParams(location.search).has('fullgrid');let reach:'ring'|'any'='ring';
  const reachButton=el('button','stellar-button');reachButton.type='button';reachButton.title='Which field cards can be played onto the foundation';
  const paintReach=()=>{reachButton.textContent=reach==='ring'?'Reach: Ring':'Reach: Anywhere';reachButton.setAttribute('aria-pressed',String(reach==='any'));};
  if(fullGrid){reachButton.classList.add('stellar-reach');root.append(reachButton);paintReach();root.dataset.fullgrid='true';}
  autoButton.setAttribute('aria-label','Play next best card; hold for auto-play');autoButton.setAttribute('aria-keyshortcuts','ControlLeft ControlRight');autoButton.title='Tap: one best card. Hold: best moves until released or no legal moves remain. Either Ctrl does the same.';
  const banner = el('div', 'stellar-banner'); banner.hidden = true; banner.setAttribute('role', 'dialog'); banner.setAttribute('aria-label', 'Night complete');
  const bannerTitle = el('h2'), bannerText = el('p'), again = el('button', 'stellar-button', 'New night'); again.type = 'button';
  banner.append(bannerTitle, bannerText, again);
  root.append(canvas, chart, chainText, heroBox, stage, controls, banner);
  document.body.replaceChildren(root);
  document.body.style.margin = '0';

  const sky = createSkyRenderer(canvas,{combat:false}), audio = new StellarAudio();
  let muted = false; try { muted = localStorage.getItem(MUTE_KEY) === 'true'; } catch { /* optional */ }
  audio.setMuted(muted);
  let battle: StellarBattle = createStellarBattle(), chain: number[] = [], named: Record<string, number> = {}, figures = 0, over = false;
  let quality = currentFxQuality();
  let finishTimer:ReturnType<typeof setTimeout>|undefined;

  function paintControls() {
    soundButton.innerHTML = muted ? SOUND_OFF : SOUND_ON;
    soundButton.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); soundButton.title = muted ? 'Sound off' : 'Sound on';
    const pref = fxPreference();
    qualityButton.textContent = `Quality: ${pref === 'auto' ? `Auto (${quality === 'low' ? 'Low' : 'High'})` : pref === 'low' ? 'Low' : 'High'}`;
    qualityButton.title = 'Visual effects quality';
  }
  soundButton.onclick = () => { muted = !muted; audio.wake(); audio.setMuted(muted); try { localStorage.setItem(MUTE_KEY, String(muted)); } catch { /* optional */ } paintControls(); };
  qualityButton.onclick = () => { const order: FxPreference[] = ['auto', 'high', 'low']; setFxPreference(order[(order.indexOf(fxPreference()) + 1) % 3]);paintControls(); };
  root.addEventListener('pointerdown', () => audio.wake(), true);
  root.addEventListener('keydown', () => audio.wake(), true);

  function paintHud() {
    const plays = Math.max(0, chain.length - 1);
    chainText.innerHTML = plays ? `Chain <b>${plays}</b>` : '&nbsp;';
  }

  function layout() {
    const c = chart.getBoundingClientRect(), h = portrait.getBoundingClientRect();
    sky.setLayout({ chart: { x: c.left, y: c.top, w: c.width, h: c.height }, foe:{x:0,y:0,r:0}, hero: center(h) });
  }

  const cardCenter = (id: string) => { const node = board.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(id)}"]`); return node ? center(node.getBoundingClientRect()) : { x: innerWidth / 2, y: innerHeight / 2 }; };

  /** Rects (0–1 of the viewport) a settled figure must stay clear of. */
  function reserved(): Rect[] {
    const W = innerWidth, H = innerHeight, norm = (r: DOMRect, pad = 0): Rect => ({ x: (r.left - pad) / W, y: (r.top - pad) / H, w: (r.width + pad * 2) / W, h: (r.height + pad * 2) / H });
    const cards = [...board.querySelectorAll<HTMLElement>('.card:not(.gone), .slot')].map(n => n.getBoundingClientRect()).filter(r => r.width);
    const box = cards.reduce((a, r) => ({ l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) }), { l: W, t: H, r: 0, b: 0 });
    const out = [chart, chainText, heroBox, controls].map(n => norm(n.getBoundingClientRect(), 12));
    if (box.r > box.l) out.push(norm(new DOMRect(box.l, box.t, box.r - box.l, box.b - box.t), 16));
    return out;
  }

  function settleChain(now: number) {
    const plays = chain.length - 1;
    if (plays >= 2) {
      const size = sizeClass(plays), name = constellationName(plays, named[size] ?? 0); named[size] = (named[size] ?? 0) + 1;
      const wPx = Math.min(innerWidth * 0.17, 70 + plays * 16), half = { x: wPx / 2 / innerWidth, y: (wPx * 0.62) / 2 / innerHeight };
      const home = pickHome(sky.homes(), reserved(), half, innerWidth / innerHeight, figures);
      figures++;
      sky.settle(name, home, half, now);
      audio.chainEnd(chain);
    } else { sky.settle(null, null, { x: 0, y: 0 }, now); audio.chainEnd([]); }
    chain = [];
  }

  function finish(reason: string) {
    if (over) return; over = true;
    auto.stop();
    const now = performance.now();
    if (chain.length) settleChain(now);
    finishTimer=setTimeout(() => {
      bannerTitle.textContent = 'Night charted';
      bannerText.textContent = `${reason} ${figures} constellation${figures === 1 ? '' : 's'} drawn · longest chain ${battle.bestChain}.`;
      banner.hidden = false; again.focus();
    }, 700);
  }

  function onCard(card: GridCard, kind: 'start' | 'play' | 'stock') {
    if (over || battle.result) return false;
    if(!automated)auto.stop();
    audio.wake();
    const now = performance.now(), from = cardCenter(card.id);
    if (kind === 'start') {
      root.dataset.phase = 'play';
      chain = [card.rank]; sky.startChain(card.rank, now, from); audio.pick(card.rank);
      requestAnimationFrame(() => { layout(); paintHud(); });
      return true;
    }
    if (kind === 'play') {
      const result = stellarReceipt(battle), receipt = result.events[0]; battle = result.state;
      if (receipt?.kind === 'receipt') {
        chain.push(card.rank);
        sky.addStar(card.rank, receipt.tier, 0, from, now);
        audio.receipt(card.rank, receipt.chain);
      }
      paintHud();
      return true;
    }
    settleChain(now);
    battle = stellarDraw(battle).state;
    audio.draw();
    paintHud();
    return true;
  }

  let grid: ReturnType<typeof mountGridTableau>;
  let automated=false,lastHint='',foundationId:string|null=null;
  const auto=createWorldRailAutoPlay(()=>{
    if(over||document.hidden||!grid||grid.state.phase!=='play')return 'complete';
    automated=true;try{return grid.autoStep(false)?'played':'complete';}finally{automated=false;}
  },.42);
  function paintGuidance(){
    if(!grid)return;const hint=grid.bestSequence(),key=hint.kind+':'+hint.id;
    if(key!==lastHint){lastHint=key;board.querySelectorAll('[data-stellar-hint]').forEach(n=>{n.removeAttribute('data-stellar-hint');n.removeAttribute('aria-description');});if(hint.id&&(hint.kind==='foundation'||hint.kind==='card')){const node=board.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(hint.id)}"]`);if(node){node.dataset.stellarHint=hint.kind==='foundation'?'foundation':'next';node.setAttribute('aria-description',hint.kind==='foundation'?'Recommended starting foundation':'Recommended next sequence card');}}}
    autoButton.disabled=over||grid.state.phase!=='play';autoButton.dataset.autoMode=auto.mode;autoButton.setAttribute('aria-pressed',String(auto.mode!=='idle'));autoButton.textContent=auto.mode==='continuous'?'»':auto.mode==='sequence'?'▶':'▷';
  }
  const stopAuto=()=>{auto.stop();paintGuidance();};
  autoButton.onpointerdown=e=>{if(e.button!==0)return;autoButton.setPointerCapture(e.pointerId);auto.press('pointer');paintGuidance();};
  autoButton.onpointerup=()=>{auto.release('pointer');paintGuidance();};autoButton.onpointercancel=stopAuto;
  autoButton.onclick=e=>{if(e.detail===0){auto.press('button');auto.release('button');paintGuidance();}};
  addEventListener('keydown',e=>{if(!['ControlLeft','ControlRight'].includes(e.code)||e.repeat||e.altKey||e.metaKey||e.shiftKey||e.isComposing||isTextEditingTarget(e.target)||over||grid?.state.phase!=='play')return;e.preventDefault();audio.wake();auto.press(e.code);paintGuidance();},true);
  addEventListener('keyup',e=>{if(['ControlLeft','ControlRight'].includes(e.code)){auto.release(e.code);paintGuidance();}},true);
  addEventListener('blur',stopAuto);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAuto();});
  const mount = () => {
    grid = mountGridTableau({
      stage, board, padding: 36, maxScale: 1.35, onCard,...(fullGrid?{pathField:true,anyReach:()=>reach==='any'}:{denseBackfill:true,stockReselect:true}),
      paused: () => over,
      onRender: (view: GridRender) => {
        root.dataset.phase=view.phase;
        foundationId=view.foundation?.id??null;board.querySelectorAll<HTMLElement>('.card').forEach(n=>{if(n.dataset.id===foundationId)n.dataset.foundation='true';else n.removeAttribute('data-foundation');});
        if (view.phase === 'play' && view.state.over && !battle.result) { battle = stellarStuck(battle); finish('No more legal cards remain.'); }
      },
    });
  };
  reachButton.onclick=()=>{reach=reach==='ring'?'any':'ring';paintReach();grid.refresh();};
  board.addEventListener('animationstart', event => { if ((event as AnimationEvent).animationName === 'stellar-wiggle') audio.invalid(); });

  const restart = () => {
    auto.stop();clearTimeout(finishTimer);lastHint='';foundationId=null;
    banner.hidden = true; over = false; battle = createStellarBattle(); chain = []; named = {}; figures = 0;
    root.dataset.phase = 'pick'; heroImg.src = heroEmojiImage('happy'); sky.reset(); grid.dispose(); mount(); paintHud();
  };
  again.onclick=restartButton.onclick=restart;

  const applyQuality = () => { quality = currentFxQuality(); root.dataset.quality = quality; sky.resize(quality === 'low'); layout(); paintControls(); };
  addEventListener('resize', applyQuality);
  let lastFrame = 0,lastTick=performance.now();
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    const dt=Math.min(.05,(now-lastTick)/1000);lastTick=now;auto.update(dt);paintGuidance();
    if (currentFxQuality() !== quality) applyQuality();
    if (quality === 'low' && now - lastFrame < 30) return;
    lastFrame = now; sky.frame(now);
  };

  mount(); applyQuality(); paintHud(); startFxGovernor();
  requestAnimationFrame(tick);
  Object.assign(window,{__stellarCombat:{get state(){return {...battle};},get hint(){return grid.bestSequence();},get foundation(){return foundationId;},get auto(){return auto.mode;},get sky(){return {...sky.diagnostics,stars:sky.activeCount,constellations:figures};}}});
}

