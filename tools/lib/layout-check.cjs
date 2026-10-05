// Shared UI layout check for Playwright tools: finds parts that collide with
// each other or the frame's corner studs, escape their container, clip their
// own text, or render text below the 16px floor (GAME.md).
async function findLayoutDefects(page, root, { parts, cornerInset = 0, minFontSize = 16 }) {
  return page.evaluate(({ root, parts, cornerInset, minFontSize }) => {
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
      if (r.left < p.left - 0.5 || r.top < p.top - 0.5 || r.right > p.right + 0.5 || r.bottom > p.bottom + 0.5) defects.push(`${name(el)} escapes ${name(parent)}`);
      const style = getComputedStyle(el);
      if (style.overflow !== 'visible' && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && el.textContent.trim()) defects.push(`${name(el)} clips its content`);
      if (cornerInset) {
        const corners = [[hostBox.left, hostBox.top], [hostBox.right - cornerInset, hostBox.top], [hostBox.left, hostBox.bottom - cornerInset], [hostBox.right - cornerInset, hostBox.bottom - cornerInset]]
          .map(([x, y]) => ({ left: x, top: y, right: x + cornerInset, bottom: y + cornerInset }));
        if (corners.some(c => overlap(c, r))) defects.push(`${name(el)} covers a corner stud`);
      }
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const [a, b] = [items[i], items[j]];
      if (a.contains(b) || b.contains(a)) continue;
      if (overlap(box(a), box(b))) defects.push(`${name(a)} overlaps ${name(b)}`);
    }
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.textContent.trim() || !el || !visible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < minFontSize) defects.push(`${name(el)} text "${node.textContent.trim().slice(0, 20)}" is ${size}px`);
    }
    return [...new Set(defects)];
  }, { root, parts, cornerInset, minFontSize });
}
module.exports = { findLayoutDefects };
