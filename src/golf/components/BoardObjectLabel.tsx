import { useLayoutEffect, useRef } from 'react';

type BoardObjectLabelProps = {
  text: string;
  minFontSize?: number;
  maxFontSize?: number;
  className?: string;
};

/** Fits in local board coordinates, so camera zoom never changes the copy.
 * At the readability floor, excess copy stays clipped and the complete label
 * remains available through the title and accessible name of this element.
 */
export function BoardObjectLabel({ text, minFontSize = 12, maxFontSize = 18, className = '' }: BoardObjectLabelProps) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
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
    <span ref={textRef} className="board-object-label__text">{text}</span>
  </span>;
}
