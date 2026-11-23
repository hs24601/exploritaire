/** Shared 3xgrid deal/backfill rules and DOM adapter for the table and Combat Woods. */
export function mountGridTableau(options){
 const abort=new AbortController(),timers=new Set();
 const listen=(node,type,fn)=>node.addEventListener(type,fn,{signal:abort.signal});
 const setTimeout=(fn,ms)=>{const id=globalThis.setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
  const teamHand = options.teamHand === true;
  const kinRoster = [
    ['Mochi', 'characters/mochi/expressions/emojis/watercolor/v1/mochi_emoji_happy.png'],
    ['Hero', 'characters/hero/poses/watercolor/v1-opening/hero-happy-emoji-v1.png'],
    ['Demi', 'characters/dem/demi-expressions-v1.png', true],
    ['Banks', 'characters/banks/expressions/emojis/watercolor/v6/banks_emoji_happy.png'],
    ['River', 'keru/riv/riv-watercolor-v2.png'],
  ];
  const factor=options.cardScale ?? 1;
  const W = 96*factor, H = 134*factor, G = 8*factor, P = 36*factor, STOCK_GAP = 48*factor;
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  // Corners get a vertical stack (away from the centre row) and a side stack; edges get one.
  const SLOTS = [
    { id: 'A1', r: 0, c: 0, v: 'top', s: 'left' },
    { id: 'A2', r: 0, c: 1, v: 'top' },
    { id: 'A3', r: 0, c: 2, v: 'top', s: 'right' },
    { id: 'B1', r: 1, c: 0, s: 'left' },
    { id: 'B3', r: 1, c: 2, s: 'right' },
    { id: 'C1', r: 2, c: 0, v: 'bottom', s: 'left' },
    { id: 'C2', r: 2, c: 1, v: 'bottom' },
    { id: 'C3', r: 2, c: 2, v: 'bottom', s: 'right' },
  ];
  const CHEV = { top: '▾', bottom: '▴', left: '▸', right: '◂' };

  const DUMMY = { style: {}, set textContent(v) {}, get textContent() { return ''; }, set disabled(v) {} };
  const $ = (id) => stage.getRootNode().querySelector('#'+id) || DUMMY;
  const {stage,board}=options;
  const scrollSurface=options.scrollable?document.createElement('div'):null;
  if(scrollSurface){scrollSurface.className='grid-scroll-surface';Object.assign(scrollSurface.style,{position:'relative',overflow:'hidden'});stage.appendChild(scrollSurface);scrollSurface.appendChild(board);}
  let fitPhase='';
  board.style.setProperty('--w', W + 'px');
  board.style.setProperty('--h', H + 'px');
  board.style.setProperty('--p', P + 'px');

  const FC = options.fieldColumns ?? 8, FR = options.fieldRows ?? 5;
  const FW = FC * W + (FC - 1) * G, FH = FR * H + (FR - 1) * G;
  const stockEnabled=options.stockEnabled!==false,stockWidth=stockEnabled?STOCK_GAP+W:0;
  const FRAME = { w: FW + stockWidth, h: FH };
  const M = P + 8*factor;
  const PX = (FW - (2 * M + 3 * W + 2 * G)) / 2, PY = (FH - (2 * M + 3 * H + 2 * G)) / 2;
  const foundRect = { x: PX + M + W + G, y: PY + M + H + G };
  const STOCK_PICK = { x: FW + STOCK_GAP, y: (FH - H) / 2 };
  const STOCK_PLAY = { x: PX + 2 * M + 3 * W + 2 * G + STOCK_GAP, y: PY + M + H + G };
  let stockXY = STOCK_PICK;

  let mode = 'alt', wrap = true, infinite = true, genCount = 0;
  let seed = 0, cards = {}, st = null, history = [], best = 0, scale = 1, els = {};
  let unfoldedFrom=null;
  let hintKey='',hintValue=null;
  function knownSequence(slots,rank,limit=12){
    let nodes=0;
    function search(current,value,depth){
      if(!depth||++nodes>2000)return {length:0,slot:null,path:[]};let best={length:0,slot:null,path:[]};
      for(const s of SLOTS){const sl=current[s.id];if(!sl.top||!legal(cards[sl.top].rank,value))continue;
        const copy={...sl,v:[...sl.v],s:[...sl.s]},next=nextStack(s.id,copy),newRank=cards[sl.top].rank;
        copy.top=next?copy[next].shift():null;if(next)copy.turn=next==='v'?'s':'v';
        const tail=search({...current,[s.id]:copy},newRank,depth-1),length=1+tail.length;if(length>best.length)best={length,slot:s.id,path:[sl.top,...tail.path]};if(length===depth)return best;
      }return best;
    }return search(slots,rank,limit);
  }
  /** Advisory only: inspect known cards, never refill or consume a receipt. */
  function bestSequence(excludeFoundationId,preferredFoundationId){
    const ids=st.phase==='pick'?st.field.filter(Boolean):[...st.found.slice(-1),...Object.values(st.slots).flatMap(s=>[s.top,...s.v,...s.s]).filter(Boolean)];
    const key=JSON.stringify([st.phase,st.originIndex,excludeFoundationId,preferredFoundationId,ids.map(id=>[id,cards[id].rank]),st.phase==='play'?Object.values(st.slots).map(s=>[s.top,s.v,s.s,s.turn]):null]);
    if(key===hintKey)return hintValue;hintKey=key;
    let best={id:st.phase==='play'?topFound()?.id ?? null:null,length:0,kind:'return'};
    if(st.phase==='pick'){
      const preferred=st.field.indexOf(preferredFoundationId),distance=i=>preferred<0?i:Math.hypot(i%FC-preferred%FC,(Math.floor(i/FC)-Math.floor(preferred/FC))*H/W);
      const candidates=st.field.map((id,i)=>({id,i})).filter(({id,i})=>id&&id!==excludeFoundationId&&pickable(i)).sort((a,b)=>distance(a.i)-distance(b.i));
      for(const {id,i}of candidates){const fp=footprint(i),path=knownSequence(fp.slots,cards[id].rank);if(path.length>best.length)best={id,length:path.length,kind:'foundation'};}
    }
    else if(!options.pathField && topFound()){const path=knownSequence(st.slots,topFound().rank);if(path.slot)best={id:st.slots[path.slot].top,length:path.length,kind:'card'};}
    hintValue=best;return best;
  }

  function rng(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function deal(newSeed) {
    seed = newSeed;
    const rand = rng(seed);
    const deck = [];
    for (let su = 0; su < 4; su++) for (let r = 1; r <= 13; r++) deck.push({ id: 'c' + su + '_' + r, rank: r, suit: su });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    cards = {}; deck.forEach((c) => { cards[c.id] = c; });
    const mask=Array.from({length:FC*FR},(_,i)=>options.fieldMask?.[i]!==false),needed=mask.filter(Boolean).length;
    // Larger world fields keep a twelve-card stock; the standalone table retains its original deck/deal.
    while(deck.length<needed+12){const c={id:'field-'+deck.length,rank:1+Math.floor(rand()*13),suit:0};deck.push(c);cards[c.id]=c;}
    const ids = deck.map((c) => c.id);let at=0;
    st = { phase: 'pick', field: mask.map(inside=>inside?ids[at++]:null), stock: stockEnabled?ids.slice(at):[], preview: null, streak: 0, over: null };
    if (teamHand) {
      const ranks = new Set();
      const hand = [];
      for (const card of deck) {
        if (ranks.has(card.rank)) continue;
        ranks.add(card.rank);
        const [name, image, sheet] = kinRoster[hand.length];
        card.kin = {name, image, sheet};
        hand.push(card.id);
        if (hand.length === kinRoster.length) break;
      }
      const field = deck.filter(card => !hand.includes(card.id)).map(card => card.id).slice(0, FC * FR);
      const origin = Math.floor(FR / 2) * FC + Math.floor(FC / 2);
      field[origin] = null;
      st.field = field;
      const {slots} = footprint(origin);
      st = {phase:'play', field, slots, stock:[], found:[], out:[], hand, ap:Object.fromEntries(hand.map(id => [id, 0])), tapped:[], anchor:null, streak:0, over:null};
    }
    if (options.spellDeal) {
      const {min,max} = options.spellDeal;
      const center = 12; // The 5×5 field contributes eight tops and twelve backfills.
      let accepted;
      for (let attempt=0; attempt<64; attempt++) {
        st.field.forEach(id => { cards[id].rank = 1 + Math.floor(rand()*13); });
        const fp = footprint(center);
        const length = knownSequence(fp.slots,cards[fp.found].rank,max ? max+1 : min).length;
        if (length>=min && (!max || length<=max)) { accepted=fp;break; }
      }
      if (!accepted) {
        st.field.forEach(id => { cards[id].rank=7; });
        const order = min>=10 ? [6,1,11,10,16,21,17,22,18,23] : [7];
        if (min>=10) order.forEach((index,i)=>{cards[st.field[index]].rank=8+i; if(cards[st.field[index]].rank>13)cards[st.field[index]].rank-=13;});
        else cards[st.field[order[0]]].rank=8;
        accepted=footprint(center);
      }
      st={phase:'play',originIndex:center,field:st.field,stock:[],slots:accepted.slots,found:[accepted.found],out:st.field.filter(id=>!accepted.used.has(id)),streak:0,over:null};
    }
    history = [];
    build();
    if (teamHand) refill();
    render();
  }

  const fieldAt = (r, c) => (r >= 0 && r < FR && c >= 0 && c < FC) ? st.field[r * FC + c] : null;
  const pickable = (i) => { const r = Math.floor(i / FC), c = i % FC; return r > 0 && r < FR - 1 && c > 0 && c < FC - 1 && [-1,0,1].every(dr=>[-1,0,1].every(dc=>!!fieldAt(r+dr,c+dc))); };

  // The foundation's 8 neighbours become the grid; each neighbour's stack is the line of field cards beyond it.
  function footprint(i) {
    const r = Math.floor(i / FC), c = i % FC;
    const fp = { found: st.field[i], slots: {}, used: new Set([st.field[i]]) };
    const line = (r0, c0, dr, dc) => { const out = []; for (let rr = r0, cc = c0; fieldAt(rr, cc); rr += dr, cc += dc) { out.push(fieldAt(rr, cc)); fp.used.add(fieldAt(rr, cc)); } return out; };
    for (const s of SLOTS) {
      const nr = r + s.r - 1, nc = c + s.c - 1;
      const top = fieldAt(nr, nc); fp.used.add(top);
      const v = s.v ? line(s.v === 'top' ? nr - 1 : nr + 1, nc, s.v === 'top' ? -1 : 1, 0) : [];
      const sd = s.s ? line(nr, s.s === 'left' ? nc - 1 : nc + 1, 0, s.s === 'left' ? -1 : 1) : [];
      fp.slots[s.id] = { top, v, s: sd, turn: 'v' };
    }
    return fp;
  }

  // Infinite backfill: every stack a slot owns always holds at least one card; new cards are random ranks.
  function refill() {
    if (options.spellDeal || !infinite || st.phase !== 'play') return [];
    const made = [];
    for (const s of SLOTS) {
      const sl = st.slots[s.id];
      for (const k of ['v', 's']) {
        if (!s[k]) continue;
        const capacity=options.denseBackfill?(sl[k+'Capacity']??1):1;
        while(sl[k].length<capacity){
        const c = { id: 'g' + (++genCount), rank: 1 + Math.floor(Math.random() * 13), suit: 0 };
        cards[c.id] = c;
        board.appendChild(makeCard(c)).dataset.fresh = '1';
        sl[k].push(c.id);
        made.push(c.id);
        }
      }
    }
    return made;
  }

  function confirmPick(i) {
    if(options.paused?.() || options.onCard?.(cards[st.field[i]],'start')===false)return;
    if(options.pathField){st={phase:'play',fieldIndex:i,field:st.field,stock:st.stock,slots:{},found:[st.field[i]],out:[],streak:0,over:null};render();return;}
    const fp = footprint(i);
    for(const sl of Object.values(fp.slots)){sl.vCapacity=Math.max(1,sl.v.length);sl.sCapacity=Math.max(1,sl.s.length);}
    st = {
      phase: 'play', originIndex:i, field: st.field, stock: st.stock, slots: fp.slots, found: [fp.found],
      out: st.field.filter((id) => id&&!fp.used.has(id)), streak: 0, over: null,
    };
    history = [];
    const born = refill();
    checkOver();
    const delay = {};
    born.forEach((id) => { delay[id] = 260; });
    for (const s of SLOTS) { const sl = st.slots[s.id]; delay[sl.top] = 80; sl.v.concat(sl.s).forEach((id, k) => { delay[id] = 180 + k * 40; }); }
    render({ delay });
  }

  function nextStack(slot, sl) {
    const hasV = sl.v.length > 0, hasS = sl.s.length > 0;
    if (!hasV && !hasS) return null;
    if (!hasV) return 's';
    if (!hasS) return 'v';
    if (mode === 'v') return 'v';
    if (mode === 's') return 's';
    if (mode === 'deep') return sl.v.length >= sl.s.length ? 'v' : 's';
    return sl.turn;
  }

  const legal = (a, b) => { const d = Math.abs(a - b); return d === 1 || (wrap && d === 12); };
  // stockLimit caps how many stock cards are usable (and shown), e.g. by a kin's remaining stamina.
  const stockAvail = () => Math.min(st.stock.length, options.stockLimit?.() ?? Infinity);
  const topFound = () => cards[st.found[st.found.length - 1]];
  const snapshot = () => JSON.parse(JSON.stringify(st));
  const neighboringField=(a,b)=>a!==b&&Math.abs(Math.floor(a/FC)-Math.floor(b/FC))<=1&&Math.abs(a%FC-b%FC)<=1;
  // Path field reach: the 3x3 ring around the foundation, or (anyReach) any field card.
  const reachable=(index)=>options.anyReach?.()?index!==st.fieldIndex:neighboringField(st.fieldIndex,index);
  function playField(index){
    const id=st.field[index];if(!id||!reachable(index)||!legal(cards[id].rank,topFound().rank)||options.paused?.())return false;
    if(options.onCard?.(cards[id],'play')===false)return false;
    const old=st.fieldIndex,c={id:'g'+(++genCount),rank:1+Math.floor(Math.random()*13),suit:0};cards[c.id]=c;board.appendChild(makeCard(c));st.field[old]=c.id;st.fieldIndex=index;st.found.push(id);st.streak++;st.over=null;render();return true;
  }

  function canTeam(id) {
    return st.hand.includes(id) && id !== st.anchor && !st.tapped.includes(id)
      && (!topFound() || legal(cards[id].rank, topFound().rank));
  }

  function sourceOf(id) {
    if (st.phase !== 'play' || st.over) return null;
    if(teamHand && canTeam(id)) return {kind:'team'};
    if(teamHand && !topFound()) return null;
    if(options.pathField){const index=st.field.indexOf(id);if(index>=0&&reachable(index))return {kind:'field',index};return st.stock[st.stock.length-1]===id?{kind:'stock'}:null;}
    for (const s of SLOTS) if (st.slots[s.id].top === id) return { kind: 'slot', slot: s.id };
    if (st.stock.length && st.stock[st.stock.length - 1] === id) return { kind: 'stock' };
    return null;
  }

  function playSlot(slotId) {
    const sl = st.slots[slotId];
    const id = sl.top;
    if (!id || !legal(cards[id].rank, topFound().rank)) return null;
    if(options.paused?.() || options.onCard?.(cards[id],'play')===false)return null;
    history.push(snapshot());
    st.found.push(id);
    const which = nextStack(slotId, sl);
    let incoming = null;
    if (which) {
      incoming = sl[which].shift();
      sl.top = incoming;
      if (which === 'v' || which === 's') sl.turn = which === 'v' ? 's' : 'v';
    } else sl.top = null;
    st.streak++;
    if (teamHand) st.ap[st.anchor]++;
    best = Math.max(best, st.streak);
    const born = refill();
    checkOver();
    return { moved: id, incoming, born };
  }

  function drawStock() {
    if (!stockEnabled || !stockAvail() || st.over) return null;
    history.push(snapshot());
    const id = st.stock[st.stock.length-1];
    if(options.paused?.() || options.onCard?.(cards[id],'stock')===false){history.pop();return null;}
    st.stock.pop();
    st.found.push(id);
    if(options.pathField)st.field[st.fieldIndex]=id;
    st.streak = 0;
    if(options.stockReselect&&!options.pathField){reopen();return {moved:id};}
    checkOver();
    return { moved: id };
  }

  function checkOver() {
    if(options.pathField){if(!stockAvail()&&!st.field.some((id,i)=>id&&reachable(i)&&legal(cards[id].rank,topFound().rank)))st.over='lose';return;}
    const tops = SLOTS.map((s) => st.slots[s.id].top).filter(Boolean);
    if (!tops.length) { st.over = 'win'; return; }
    if (teamHand || options.spellDeal) return;
    const f = topFound().rank;
    if (!stockAvail() && !tops.some((id) => legal(cards[id].rank, f))) st.over = 'lose';
  }

  /** Reconstruct the current field, including the latest ranks and refill queues. */
  function reopen(){
    if(options.paused?.()||st.phase!=='play'||options.pathField)return false;
    unfoldedFrom=snapshot();const field=[...st.field],origin=st.originIndex,r=Math.floor(origin/FC),c=origin%FC;
    const put=(row,col,id)=>{const i=row*FC+col;if(row>=0&&row<FR&&col>=0&&col<FC&&field[i]&&id)field[i]=id;};
    put(r,c,st.found[st.found.length-1]);
    for(const s of SLOTS){const sl=st.slots[s.id],row=r+s.r-1,col=c+s.c-1;put(row,col,sl.top);if(s.v)sl.v.forEach((id,i)=>put(row+(s.r===0?-1:1)*(i+1),col,id));if(s.s)sl.s.forEach((id,i)=>put(row,col+(s.c===0?-1:1)*(i+1),id));}
    st={phase:'pick',field,stock:st.stock,preview:null,streak:0,over:null};build();render();return true;
  }

  function undo() {
    if (!history.length) return;
    st = history.pop();
    render();
  }

  // ---------- layout ----------
  function cell(r, c) { return { x: PX + M + c * (W + G), y: PY + M + r * (H + G) }; }
  const fieldXY = (i) => ({ x: (i % FC) * (W + G), y: Math.floor(i / FC) * (H + G) });

  function build() {
    board.innerHTML = '';
    els = {};
    board.style.width = FRAME.w + 'px';
    board.style.height = FRAME.h + 'px';
    if(stockEnabled){
    const sEl = addSlot(stockXY, ''); sEl.classList.add('stockwell'); sEl.id = 'stockWell';
    const lbl = document.createElement('div');
    lbl.className = 'stocklabel'; lbl.id = 'stockLabel';
    lbl.style.left = stockXY.x + 'px'; lbl.style.width = W + 'px'; lbl.style.top = (stockXY.y + H + 8) + 'px';
    board.appendChild(lbl);
    }
    const fEl = addSlot(foundRect, teamHand ? 'Foundation' : ''); fEl.classList.add('found'); fEl.id = 'foundSlot';
    for (const id in cards) board.appendChild(makeCard(cards[id]));
    fit();
  }

  function addSlot(p, label) {
    const d = document.createElement('div');
    d.className = 'slot';
    d.style.cssText = `left:${p.x}px;top:${p.y}px;width:${W}px;height:${H}px`;
    if (label) d.innerHTML = `<span class="lbl">${label}</span>`;
    board.appendChild(d);
    return d;
  }

  function makeCard(c) {
    const r = RANKS[c.rank];
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = c.id;
    el.setAttribute('aria-label', 'Card ' + r);el.setAttribute('role','button');el.tabIndex=0;
    el.innerHTML = `<div class="inner"><div class="face front">
        <span class="idx tl">${r}</span>
        <span class="idx br">${r}</span>
        <span class="pip"><span class="r">${r}</span></span>
        <span class="peek"><span>${r}</span><span class="chev"></span></span>
      </div><div class="face back"></div></div>`;
    if (c.kin) {
      el.classList.add('team-kin');
      const front = el.querySelector('.front');
      const portrait = document.createElement('span');
      portrait.className = 'team-portrait';
      portrait.style.backgroundImage = 'url("' + import.meta.env.BASE_URL + 'assets/runtime/' + c.kin.image + '")';
      if (c.kin.sheet) portrait.classList.add('team-portrait-sheet');
      const name = document.createElement('span');
      name.className = 'team-name';
      name.textContent = c.kin.name;
      const ap = document.createElement('span');
      ap.className = 'team-ap';
      front.append(portrait, name, ap);
    }
    els[c.id] = el;
    return el;
  }

  function tilt(id) { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((Math.abs(h) % 9) - 4) * 0.9; }

  function layout() {
    const out = {};
    stockXY = st.phase === 'play' && !options.pathField ? STOCK_PLAY : STOCK_PICK;
    const well = $('stockWell'), lab = $('stockLabel');
    well.style.left = stockXY.x + 'px'; well.style.top = stockXY.y + 'px';
    lab.style.left = stockXY.x + 'px'; lab.style.top = (stockXY.y + H + 8) + 'px';
    const hiddenStock = st.stock.length - stockAvail();
    st.stock.forEach((id, i) => { out[id] = { x: stockXY.x - Math.min(i, 12) * 0.5, y: stockXY.y - Math.min(i, 12) * 0.6, z: 200 + i, down: true, gone: i < hiddenStock }; });
    if (st.phase === 'pick') {
      const fp = st.preview != null ? footprint(st.preview) : null;
      const role = (id) => {
        if (!fp) return null;
        if (id === fp.found) return 'found';
        for (const s of SLOTS) { const sl = fp.slots[s.id]; if (sl.top === id) return 'top'; if (sl.v.includes(id) || sl.s.includes(id)) return 'back'; }
        return 'off';
      };
      st.field.forEach((id, i) => { if(id)out[id] = { ...fieldXY(i), z: 100, pv: role(id), pick: pickable(i) }; });
      return out;
    }
    if(options.pathField){st.field.forEach((id,i)=>{if(id)out[id]={...fieldXY(i),z:100,pick:reachable(i)};});return out;}
    st.field.forEach((id, i) => { if (id&&st.out.includes(id)) out[id] = { ...fieldXY(i), z: 1, gone: true }; });
    for (const s of SLOTS) {
      const sl = st.slots[s.id], base = cell(s.r, s.c);
      const nxt = nextStack(s.id, sl);
      if (sl.top) out[sl.top] = { x: base.x, y: base.y, z: 100 };
      sl.v.forEach((id, i) => {
        out[id] = { x: base.x, y: base.y + (s.v === 'top' ? -P : P), z: 98 - i, peek: s.v, next: i === 0 && nxt === 'v' };
      });
      sl.s.forEach((id, i) => {
        out[id] = { x: base.x + (s.s === 'left' ? -P : P), y: base.y, z: 98 - i, peek: s.s, next: i === 0 && nxt === 's' };
      });
    }
    if (teamHand) {
      const visibleHand = st.hand.filter(id => id !== st.anchor);
      const middle = (visibleHand.length - 1) / 2;
      visibleHand.forEach((id, i) => {
        const offset = i - middle;
        out[id] = {
          x: foundRect.x + offset * W * 0.88,
          y: handY + offset ** 2 * G,
          rot: offset * 7,
          z: 110 + i,
          hand: true,
        };
      });
    }
    st.found.forEach((id, i) => { if (options.spellDeal && id !== topFound().id) return; out[id] = { x: foundRect.x, y: foundRect.y, z: 300 + i, rot: options.spellDeal || i === 0 ? 0 : tilt(id) }; });
    return out;
  }

  const handWidth = kinRoster.length * W + (kinRoster.length - 1) * G;
  const handX = (FW - handWidth) / 2;
  const handY = PY + 2 * M + 3 * H + 3 * G;
  let lastLayout = {};
  function render(opts = {}) {
    const L = layout();
    lastLayout = L;
    // Reopening can leave collected/generated IDs outside the reconstructed
    // field. They must not reappear at the board origin after build().
    for(const id in els)if(!L[id])els[id].classList.add('gone');
    const teamScores = new Map();
    if (teamHand && !st.over) {
      for (const id of st.hand.filter(canTeam)) teamScores.set(id, knownSequence(st.slots, cards[id].rank).length);
    }
    const highScore = Math.max(...teamScores.values());
    for (const id in L) {
      const p = L[id], el = els[id];
      const fresh = !!el.dataset.fresh;
      if (fresh) {
        // New infinite-backfill card: place it without travel, then fade it in.
        delete el.dataset.fresh;
        el.style.transition = 'none';
        el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        el.classList.add('gone');
        void el.offsetWidth;
        el.style.transition = '';
        setTimeout(() => el.classList.remove('gone'), ((opts.delay && opts.delay[id]) || 0) + 20);
      }
      el.style.transitionDelay = (opts.delay && opts.delay[id]) ? opts.delay[id] + 'ms' : '0ms';
      el.style.transform = `translate(${p.x}px, ${p.y}px)` + (p.rot ? ` rotate(${p.rot}deg)` : '');
      el.style.zIndex = p.z;
      el.classList.toggle('down', !!p.down);
      if (teamHand) {
        el.classList.toggle('team-hand-card', !!p.hand);
        el.classList.toggle('team-tapped', !!p.hand && st.tapped.includes(id));
        el.classList.toggle('team-glimmer', teamScores.get(id) === highScore);
        const action = st.tapped.includes(id) ? 'Tapped' : topFound() ? 'Team-up attack' : 'Choose foundation';
        const kin = cards[id].kin;
        if (kin) {
          el.querySelector('.team-ap').textContent = st.ap[id] + ' AP';
          el.setAttribute('aria-label', (p.hand ? action + ' · ' : '') + kin.name + ' · ' + RANKS[cards[id].rank] + ' · ' + st.ap[id] + ' AP');
        }
      }
      if (!fresh) el.classList.toggle('gone', !!p.gone);
      el.classList.toggle('pickable', !!p.pick);
      if (p.pv) el.dataset.pv = p.pv; else delete el.dataset.pv;
      if (p.peek) el.dataset.peek = p.peek; else delete el.dataset.peek;
      if (p.next) { el.dataset.next = ''; el.querySelector('.chev').textContent = CHEV[p.peek]; } else delete el.dataset.next;
    }
    fit();
    $('foundSlot').hidden = st.phase === 'pick';
    const lbl = $('stockLabel');
    if (lbl) lbl.textContent = stockAvail() ? 'Stock · ' + stockAvail() : 'Stock empty';
    if (teamHand) {
      $('teamStatus').textContent = st.over ? 'Grid cleared' : !topFound() ? 'Choose a foundation from your hand' : cards[st.anchor].kin.name + ' · ' + st.ap[st.anchor] + ' AP';
      $('endTeamTurn').disabled = !st.anchor || !!st.over;
    }
    if (teamHand) {
      for (const id in els) els[id].querySelector('.team-foundation-kin')?.remove();
      const current = topFound();
      if (current && current.id !== st.anchor) {
        const kinLabel = cards[st.anchor].kin.name + ' · ' + st.ap[st.anchor] + ' AP';
        const face = els[current.id].querySelector('.front');
        const label = document.createElement('span');
        label.className = 'team-foundation-kin';
        label.textContent = kinLabel;
        face.appendChild(label);
        els[current.id].setAttribute('aria-label', 'Card ' + RANKS[current.rank] + ' · ' + kinLabel);
      }
    }
    const b = $('banner');
    if (!teamHand && st.phase === 'play' && st.over) {
      b.hidden = false;
      $('bannerText').innerHTML = st.over === 'win'
        ? `<b>Grid cleared.</b> ${st.stock.length} stock card${st.stock.length === 1 ? '' : 's'} to spare.`
        : `<b>No plays left.</b> ${options.pathField?st.field.filter(Boolean).length:SLOTS.reduce((n, s) => { const sl = st.slots[s.id]; return n + (sl.top ? 1 : 0) + sl.v.length + sl.s.length; }, 0)} cards remain.`;
    } else b.hidden = true;
    for(const id in els){const el=els[id],src=sourceOf(id);el.tabIndex=st.phase==='pick'?(pickable(st.field.indexOf(id))?0:-1):(src?0:-1);el.setAttribute('aria-disabled',String(st.phase==='pick'?!pickable(st.field.indexOf(id)):!src));}
    publish();
  }

  function fly(id) {
    const el = els[id];
    el.classList.remove('fly'); void el.offsetWidth; el.classList.add('fly');
    setTimeout(() => el.classList.remove('fly'), 400);
  }
  function wiggle(id) {
    const el = els[id];
    el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle');
    setTimeout(() => el.classList.remove('wiggle'), 320);
  }
  function shakeFoundation() {
    const f = els[st.found[st.found.length - 1]];
    if (!f) return;
    f.classList.remove('found-shake'); void f.offsetWidth; f.classList.add('found-shake');
    setTimeout(() => f.classList.remove('found-shake'), 340);
  }

  function act(src, id) {
    if (src.kind === 'team') {
      if (st.over || options.paused?.() || !canTeam(id)) return false;
      if (st.anchor) st.tapped.push(st.anchor);
      st.anchor = id;
      st.found = [id];
      render();
      fly(id);
      return true;
    }
    if(src.kind==='field')return playField(src.index);
    let res = null;
    if (src.kind === 'slot') res = playSlot(src.slot);
    else res = drawStock();
    if (!res) return false;
    const delay = {};
    if (res.incoming) delay[res.incoming] = 170;
    (res.born || []).forEach((id) => { delay[id] = 320; });
    render({ delay });
    fly(res.moved);
    return true;
  }

  function fit() {
    const box = teamHand ? {x:handX, y:PY, w:handWidth, h:handY + H + 6 * G - PY} : st && st.phase === 'play' && !options.pathField
      ? { x: PX, y: PY, w: 2 * M + 3 * W + 2 * G + stockWidth, h: 2 * M + 3 * H + 2 * G }
      : { x: 0, y: 0, w: FRAME.w, h: FRAME.h };
    const r = options.scrollable?{width:stage.clientWidth,height:stage.clientHeight}:stage.getBoundingClientRect();
    const pad = (options.padding ?? 56)*factor;
    const width = r.width - (teamHand ? $('teamStatus').parentElement.offsetWidth + 16 : 0);
    scale = Math.min((width - pad * 2) / box.w, (r.height - pad * 2) / box.h, options.maxScale ?? 1.35);
    scale = Math.max(scale, typeof options.minScale==='function'?options.minScale():options.minScale??0.3);
    const ox = (options.scrollable?Math.max(pad,(r.width-box.w*scale)/2):(width-box.w*scale)/2)-box.x*scale;
    const oy = (options.scrollable?Math.max(pad,(r.height-box.h*scale)/2):(r.height-box.h*scale)/2)-box.y*scale;
    if(scrollSurface){board.style.width='0px';board.style.height='0px';scrollSurface.style.width=Math.max(r.width,box.w*scale+pad*2)+'px';scrollSurface.style.height=Math.max(r.height,box.h*scale+pad*2)+'px';if(fitPhase!==st.phase){stage.scrollLeft=0;stage.scrollTop=0;fitPhase=st.phase;}}
    board.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
    publish();
  }
  function publish(){options.onRender?.({phase:st.phase,foundation:st.phase==='play'?(topFound() ?? null):null,rect:{...foundRect,width:W,height:H},scale,layout:lastLayout,cards,state:st});}
  const observer=new ResizeObserver(fit);observer.observe(stage);

  // ---------- input: pointer events cover mouse, touch and pen ----------
  let drag = null;
  listen(board,'pointerdown', (e) => {
    if (e.button > 0 || options.paused?.()) return;
    const el = e.target.closest('.card');
    if (!el) return;
    const id = el.dataset.id, src = sourceOf(id);
    if (!src) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    drag = { id, el, src, pid: e.pointerId, sx: e.clientX, sy: e.clientY, base: lastLayout[id], moved: false };
  });
  listen(board,'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = (e.clientX - drag.sx) / scale, dy = (e.clientY - drag.sy) / scale;
    if (!drag.moved && Math.hypot(dx, dy) * scale < 6) return;
    if (!drag.moved) { drag.moved = true; drag.el.classList.add('dragging'); drag.el.style.zIndex = 1000; drag.el.style.transitionDelay = '0ms'; }
    drag.dx = dx; drag.dy = dy;
    drag.el.style.transform = `translate(${drag.base.x + dx}px, ${drag.base.y + dy}px)`;
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    d.el.classList.remove('dragging');
    if (!d.moved) {
      if (cancelled) return;
      if (!act(d.src, d.id)) { wiggle(d.id); if (d.src.kind === 'slot') shakeFoundation(); }
      return;
    }
    const cx = d.base.x + d.dx + W / 2, cy = d.base.y + d.dy + H / 2;
    const over = !cancelled && cx > foundRect.x - 24 && cx < foundRect.x + W + 24 && cy > foundRect.y - 24 && cy < foundRect.y + H + 24;
    if (over && act(d.src, d.id)) return;
    if (over) shakeFoundation();
    render();
  }
  function pickIndex(e) {
    const el = e.target.closest && e.target.closest('.card');
    if (!el) return -1;
    const i = st.field.indexOf(el.dataset.id);
    return i >= 0 && pickable(i) ? i : -1;
  }
  listen(board,'pointerover', (e) => {
    if (st.phase !== 'pick' || e.pointerType !== 'mouse') return;
    const i = pickIndex(e);
    if (i >= 0 && i !== st.preview) { st.preview = i; render(); }
  });
  listen(stage,'pointerleave', (e) => {
    if (st.phase === 'pick' && e.pointerType === 'mouse' && st.preview != null) { st.preview = null; render(); }
  });
  listen(board,'pointerup', (e) => {
    if(options.paused?.())return endDrag(e,true);
    if (st.phase !== 'pick') return endDrag(e, false);
    const i = pickIndex(e);
    if (i < 0) return;
    if (options.singleClickPick || st.preview === i) confirmPick(i);
    else { st.preview = i; render(); }
  });
  listen(board,'pointercancel', (e) => endDrag(e, true));

  // ---------- controls ----------
  const newSeed = () => Math.floor(Math.random() * 9000) + 1000;
  $('bannerNew').onclick = () => deal(options.seed ?? newSeed());
  $('chkInfinite').onchange = (e) => {
    infinite = e.target.checked;
    if (st.phase === 'play' && !st.over) { const born = refill(); const delay = {}; born.forEach((id) => { delay[id] = 60; }); checkOver(); render({ delay }); }
  };

  if (teamHand) {
    $('newTeamDeal').onclick = () => deal(options.seed ?? newSeed());
    $('endTeamTurn').onclick = () => {
      if (!st.anchor || st.over) return;
      st.tapped = [];
      st.anchor = null;
      st.found = [];
      st.streak = 0;
      render();
    };
  }
  deal(options.seed ?? newSeed());

  listen(board,'keydown',e=>{
    if(!['Enter',' '].includes(e.key)||options.paused?.())return;
    const el=e.target.closest('.card');if(!el)return;e.preventDefault();
    if(st.phase==='pick'){const i=st.field.indexOf(el.dataset.id);if(i>=0&&pickable(i))confirmPick(i);}
    else {const src=sourceOf(el.dataset.id);if(src)act(src,el.dataset.id);}
  });
  return {get state(){return st;},get cards(){return cards;},
    bestSequence,
    bestPath(){return st.phase==='play'&&!options.pathField&&topFound()?knownSequence(st.slots,topFound().rank).path:[];},
    preview(id){if(st.phase!=='pick'||id!=null&&options.paused?.())return false;const index=id==null?null:st.field.indexOf(id);if(index!==null&&(index<0||!pickable(index)))return false;if(st.preview!==index){st.preview=index;render();}return true;},
    reopen,
    cancelReopen(){if(!unfoldedFrom||st.phase!=='pick')return false;st=unfoldedFrom;unfoldedFrom=null;build();render();return true;},
    /** Re-check reach and the end state after an option such as anyReach changes. */
    refresh(){if(st.phase==='play'){st.over=null;checkOver();render();}},
    activate(id){if(options.paused?.())return false;if(st.phase==='pick'){const i=st.field.indexOf(id);if(i<0||!pickable(i))return false;confirmPick(i);return st.phase==='play';}if(options.pathField){if(st.stock[st.stock.length-1]===id)return !!drawStock()&&(render(),true);return playField(st.field.indexOf(id));}const src=sourceOf(id);return src?act(src,id):false;},
    autoStep(draw=false){
      if(st.phase!=='play'||!topFound()||st.over||options.paused?.())return false;
      if(options.pathField&&options.anyReach?.()){const next=st.field.findIndex((id,i)=>id&&reachable(i)&&legal(cards[id].rank,topFound().rank));return next>=0?playField(next):draw&&st.stock.length?!!drawStock()&&(render(),true):false;}
      if(options.pathField){
        let nodes=0;
        function knownPath(index,rank,seen,depth){
          if(!depth||++nodes>2000)return {length:0,index:-1};let best={length:0,index:-1};const row=Math.floor(index/FC),col=index%FC;
          for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
            const r=row+dr,c=col+dc,next=r*FC+c,id=st.field[next];if((!dr&&!dc)||r<0||r>=FR||c<0||c>=FC||!id||seen.has(next)||!legal(rank,cards[id].rank))continue;
            const visited=new Set(seen);visited.add(next);const length=1+knownPath(next,cards[id].rank,visited,depth-1).length;if(length>best.length)best={length,index:next};
          }return best;
        }
        const next=knownPath(st.fieldIndex,topFound().rank,new Set([st.fieldIndex]),12).index;
        return next>=0?playField(next):draw&&st.stock.length?!!drawStock()&&(render(),true):false;
      }
      const hint=bestSequence();
      return hint.kind==='card'?act(sourceOf(hint.id),hint.id):draw&&st.stock.length?act({kind:'stock'},st.stock[st.stock.length-1]):false;
    },
    setFoundationRank(rank){if(st.phase==='play'&&topFound().rank!==rank){cards[topFound().id].rank=rank;const el=els[topFound().id];el.querySelectorAll('.idx,.r,.peek>span:first-child').forEach(n=>n.textContent=RANKS[rank]);render();}},
    dispose(){abort.abort();observer.disconnect();timers.forEach(clearTimeout);board.replaceChildren();scrollSurface?.replaceWith(board);}
  };

}

