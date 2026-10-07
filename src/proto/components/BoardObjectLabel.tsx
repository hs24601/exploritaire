import { useLayoutEffect, useRef } from 'react';

type BoardObjectLabelProps = {
  text: string;
  minFontSize?: number;
  maxFontSize?: number;
  className?: string;
  /** Reports where the fitted text's ink sits, in untransformed layout px
   * from the border box of the label's positioned parent (the board piece). */
  onTextBox?: (box: { left: number; top: number; width: number; height: number }) => void;
};

/** Fits in local board coordinates, so camera zoom never changes the copy.
 * At the readability floor, excess copy stays clipped and the complete label
 * remains available through the title and accessible name of this element.
 */
export function BoardObjectLabel({ text, minFontSize = 12, maxFontSize = 18, className = '', onTextBox }: BoardObjectLabelProps) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const onTextBoxRef = useRef(onTextBox);
  onTextBoxRef.current = onTextBox;
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = textRef.current;
    if (!frame || !content) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !frame.clientWidth || !frame.clientHeight) return;
      const minimum = Math.max(1, minFontSize);
      const maximum = Math.max(minimum, maxFontSize);
      let best = minimum;
      // Integer sizes avoid subpixel oscillation and keep pixel text crisp.
      for (let size = Math.floor(maximum); size >= Math.ceil(minimum); size--) {
        content.style.fontSize = `${size}px`;
        if (content.scrollWidth <= frame.clientWidth && content.scrollHeight <= frame.clientHeight) {
          best = size;
          break;
        }
      }
      content.style.fontSize = `${best}px`;
      frame.dataset.labelOverflow = String(content.scrollHeight > frame.clientHeight || content.scrollWidth > frame.clientWidth);
      // Centred text: the ink is as wide as its widest line, centred in the
      // text block, and as tall as the block (clipped to the frame).
      const ink = inkRef.current;
      const parent = content.offsetParent as HTMLElement | null;
      if (ink && onTextBoxRef.current) {
        const width = Math.min(ink.offsetWidth, content.clientWidth);
        const top = Math.max(content.offsetTop, frame.offsetTop);
        const bottom = Math.min(content.offsetTop + content.offsetHeight, frame.offsetTop + frame.clientHeight);
        const border = parent ? { x: parent.clientLeft, y: parent.clientTop } : { x: 0, y: 0 };
        onTextBoxRef.current({ left: border.x + content.offsetLeft + (content.clientWidth - width) / 2, top: border.y + top, width, height: bottom - top });
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    document.fonts.ready.then(fit);
    document.fonts.addEventListener('loadingdone', fit);
    return () => {
      disposed = true;
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', fit);
    };
  }, [text, minFontSize, maxFontSize]);
  return <span ref={frameRef} className={`board-object-label ${className}`} title={text} aria-label={text}>
    <span ref={textRef} className="board-object-label__text"><span ref={inkRef}>{text}</span></span>
  </span>;
}
