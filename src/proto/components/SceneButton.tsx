import { useRef, type ButtonHTMLAttributes } from 'react';

/** Touch releases activate even after a captured orbit suppresses synthetic clicks. */
export function SceneButton({ onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const touchClick = useRef(false);
  return <button {...props}
    onPointerDown={event => {
      touchClick.current = event.pointerType === 'touch';
      touchStart.current = event.pointerType === 'touch' ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    }}
    onPointerUp={event => {
      const start = touchStart.current; touchStart.current = null;
      const rect = event.currentTarget.getBoundingClientRect();
      if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8
        && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) event.currentTarget.click();
    }}
    onPointerCancel={() => { touchStart.current = null; }}
    onClick={event => { if (event.detail === 0 || !touchClick.current) onClick?.(event); }} />;
}
