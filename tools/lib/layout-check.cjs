// Shared UI layout check for Playwright tools: finds parts that collide with
// each other or the frame's corner studs, escape their container, clip their
// own text, or render text below the 16px floor (GAME.md).
// forbidScroll (GAME.md, 2026-11-24): any element under root that scrolls, or a page that
// scrolls, is a defect.
async function findLayoutDefects(page, root, { parts, cornerInset = 0, minFontSize = 16, forbidScroll = false }) {
  return page.evaluate(({ root, parts, cornerInset, minFontSize, forbidScroll }) => {
    const host = document.querySelector(root);
    if (!host) return [`${root}: not found`];
    const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.clip !== 'rect(0px, 0px, 0px, 0px)'; };
    const name = (el) => el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] + (el.dataset.supply ? `[${el.dataset.supply}]` : el.dataset.questSlot ? `[slot ${el.dataset.questSlot}]` : '') : el.tagName;
    const items = [...host.querySelectorAll(parts)].filter(visible);
    const box = (el) => el.getBoundingClientRect();
    const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
    const defects = [];
    const hostBox = box(host);
    for (const el of items) {
      const r = box(el);
      const parent = items.filter(other => other !== el && other.contains(el)).pop() ?? host;
      const p = box(parent);
      // Content inside a scroll container is reachable, so only its own box must fit.
      const scrolls = (node) => /(auto|scroll)/.test(getComputedStyle(node).overflowY + getComputedStyle(node).overflowX);
      const scrolledAway = [...items, host].some(other => other !== el && other.contains(el) && scrolls(other));
      if (!scrolledAway && (r.left < p.left - 0.5 || r.top < p.top - 0.5 || r.right > p.right + 0.5 || r.bottom > p.bottom + 0.5)) defects.push(`${name(el)} escapes ${name(parent)}`);
      const style = getComputedStyle(el);
      // Line-clamped text ends in an ellipsis on purpose; its full text is shown elsewhere.
      const clamped = (style.webkitLineClamp || 'none') !== 'none';
      if (style.overflow !== 'visible' && !scrolls(el) && !clamped && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && el.textContent.trim()) defects.push(`${name(el)} clips its content`);
      if (cornerInset) {
        const corners = [[hostBox.left, hostBox.top], [hostBox.right - cornerInset, hostBox.top], [hostBox.left, hostBox.bottom - cornerInset], [hostBox.right - cornerInset, hostBox.bottom - cornerInset]]
          .map(([x, y]) => ({ left: x, top: y, right: x + cornerInset, bottom: y + cornerInset }));
        if (corners.some(c => overlap(c, r))) defects.push(`${name(el)} covers a corner stud`);
      }
    }
    // Compare only what is actually painted: clip each box to the scroll containers around it,
    // so content scrolled under a fixed bar doesn't count as a collision.
    const scrollers = [...items, host].filter(node => /(auto|scroll|hidden)/.test(getComputedStyle(node).overflowY + getComputedStyle(node).overflowX) && node !== host);
    const shown = (el) => {
      let r = box(el); r = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      for (const s of scrollers) if (s !== el && s.contains(el)) { const c = box(s); r = { left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) }; }
      return r;
    };
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const [a, b] = [items[i], items[j]];
      if (a.contains(b) || b.contains(a)) continue;
      if (overlap(shown(a), shown(b))) defects.push(`${name(a)} overlaps ${name(b)}`);
    }
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.textContent.trim() || !el || !visible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < minFontSize) defects.push(`${name(el)} text "${node.textContent.trim().slice(0, 20)}" is ${size}px`);
    }
    if (forbidScroll) {
      const doc = document.scrollingElement || document.documentElement;
      if (doc.scrollHeight > window.innerHeight + 1 || doc.scrollWidth > window.innerWidth + 1) defects.push('page scrolls');
      for (const el of [host, ...host.querySelectorAll('*')]) {
        const st = getComputedStyle(el);
        const canScroll = /(auto|scroll)/.test(st.overflowY + st.overflowX);
        if (canScroll && visible(el) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) defects.push(`${name(el)} scrolls`);
      }
    }
    return [...new Set(defects)];
  }, { root, parts, cornerInset, minFontSize, forbidScroll });
}
module.exports = { findLayoutDefects };
