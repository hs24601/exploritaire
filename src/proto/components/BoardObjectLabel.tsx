import { useLayoutEffect, useRef } from 'react';

type BoardObjectLabelProps = {
  text: string;
  minFontSize?: number;
  maxFontSize?: number;
  className?: string;
  /** Reports where the fitted text's ink sits, in untransformed layout px
   * from the border box of the label's positioned parent (the board piece),
   * and the label's centre (`pivot`), which it turns about to face a spun camera. */
  onTextBox?: (box: { left: number; top: number; width: number; height: number; pivot: { x: number; y: number } }) => void;
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
      // Measured in the board piece's box. A frame turned to face a spun
      // camera becomes the text's offsetParent, so offsets go through it.
      const piece = frame.offsetParent as HTMLElement | null;
      if (ink && onTextBoxRef.current) {
        const width = Math.min(ink.offsetWidth, content.clientWidth);
        const viaFrame = content.offsetParent === frame;
        const textX = viaFrame ? frame.offsetLeft + frame.clientLeft + content.offsetLeft : content.offsetLeft;
        const textY = viaFrame ? frame.offsetTop + frame.clientTop + content.offsetTop : content.offsetTop;
        const top = Math.max(textY, frame.offsetTop);
        const bottom = Math.min(textY + content.offsetHeight, frame.offsetTop + frame.clientHeight);
        const border = piece ? { x: piece.clientLeft, y: piece.clientTop } : { x: 0, y: 0 };
        onTextBoxRef.current({ left: border.x + textX + (content.clientWidth - width) / 2, top: border.y + top, width, height: bottom - top,
          pivot: { x: border.x + frame.offsetLeft + frame.offsetWidth / 2, y: border.y + frame.offsetTop + frame.offsetHeight / 2 } });
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
