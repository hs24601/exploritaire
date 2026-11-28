import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useDrag } from './drag';

export function InspirationReveal({ name, children, ghost, recipient, onCollect }: {
  name: string; children: ReactNode; ghost: ReactNode; recipient: RefObject<HTMLDivElement | null>; onCollect: () => void;
}) {
  const { begin, dragging } = useDrag();
  const card = useRef<HTMLButtonElement>(null);
  const hand = useRef<HTMLDivElement>(null);
  const flight = useRef<Animation | null>(null);
  const [flying, setFlying] = useState(false);
  useEffect(() => () => flight.current?.cancel(), []);

  function takeToHand() {
    if (flight.current) return;
    if (!card.current || !hand.current || !recipient.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onCollect();
      return;
    }
    card.current.getAnimations().forEach(animation => animation.finish());
    const start = card.current.getBoundingClientRect();
    const end = hand.current.getBoundingClientRect();
    const received = recipient.current.getBoundingClientRect();
    const fromX = received.x + received.width / 2 - start.x - start.width / 2;
    const fromY = received.y + received.height / 2 - start.y - start.height / 2;
    const receivedScale = received.width / start.width;
    const x = end.x + end.width / 2 - start.x - start.width / 2;
    const y = end.y + end.height / 2 - start.y - start.height / 2;
    const scale = end.width / start.width;
    setFlying(true);
    const animation = card.current.animate([
      { transform: `translate(${fromX}px, ${fromY}px) scale(${receivedScale})` },
      { transform: `translate(${fromX * .64 + x * .36}px, ${fromY * .64 + y * .36 - 22}px) rotate(-10deg) scale(${scale})`, offset: .38 },
      { transform: `translate(${x}px, ${y}px) rotate(-5deg) scale(${scale})` },
    ], { duration: 430, easing: 'cubic-bezier(.3,.7,.35,1)', fill: 'forwards' });
    flight.current = animation;
    animation.onfinish = onCollect;
  }

  return <section className={`vg-inspiration-reveal${flying ? ' is-flying' : ''}`} aria-label={`${name} reward`}>
    <div className="vg-inspiration-display">
      <p role="status">Inspiration discovered</p>
      <button type="button" className={`vg-inspiration-card${dragging?.kind === 'inspiration-reward' ? ' is-dragging' : ''}`} ref={card}
        aria-label={`Give ${name} Inspiration Card to Hero`} autoFocus disabled={flying}
        onClick={event => { if (event.detail === 0) takeToHand(); }}
        onPointerDown={event => {
          const { offsetWidth: width, offsetHeight: height } = event.currentTarget;
          begin(event, { kind: 'inspiration-reward', id: name, anchor: 'top-left', ghost, width, height },
            (_, target) => { if (target.drop === 'inspiration-recipient') takeToHand(); });
        }}>{children}</button>
      <span className="vg-inspiration-drag-cue" aria-hidden="true"><i /><i /><i /></span>
    </div>
    <div className="vg-inspiration-hand-target" ref={hand} aria-hidden="true" />
  </section>;
}
