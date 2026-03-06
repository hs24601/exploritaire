import { memo, useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export type DisassembledTextConfig = {
  text: string;
  inDuration: number;
  outDuration: number;
  inStagger: number;
  outStagger: number;
  rotationRange: number;
  gravity: number;
  velocityMin: number;
  velocityMax: number;
  delayBeforeExplosion: number;
  fontSize: string;
  fontFamily: string;
};

export const DEFAULT_DISASSEMBLED_TEXT_CONFIG: DisassembledTextConfig = {
  text: 'Disassembled',
  inDuration: 1,
  outDuration: 2.5,
  inStagger: 0.03,
  outStagger: 0.015,
  rotationRange: 2000,
  gravity: 800,
  velocityMin: 300,
  velocityMax: 600,
  delayBeforeExplosion: 3,
  fontSize: '4rem',
  fontFamily: '"Rubik Scribble", system-ui, sans-serif'
};

type Props = {
  className?: string;
  config?: DisassembledTextConfig;
};

export const DisassembledTextEffect = memo(function DisassembledTextEffect({ 
  className, 
  config = DEFAULT_DISASSEMBLED_TEXT_CONFIG 
}: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear existing content
    containerRef.current.innerHTML = '';
    
    // Split text into spans
    const chars = config.text.split('').map(char => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.style.display = 'inline-block';
      span.style.whiteSpace = 'pre';
      containerRef.current?.appendChild(span);
      return span;
    });

    // Create GSAP timeline
    const tl = gsap.timeline({ repeat: -1 });
    timelineRef.current = tl;

    gsap.set(containerRef.current, { opacity: 1 });

    // Intro animation
    tl.from(chars, {
      duration: config.inDuration,
      y: 100,
      rotation: 90,
      opacity: 0,
      ease: "elastic.out(1, 0.3)",
      stagger: config.inStagger
    });

    // Exploding animation (simulated without Physics2D plugin)
    tl.to(chars, {
      duration: config.outDuration,
      opacity: 0,
      stagger: config.outStagger,
      onUpdate: function() {
        // This is a bit tricky to simulate perfectly without the plugin
        // But we can use simple custom ease or logic
      },
      // Manually simulate physics for each char
      x: () => (Math.random() - 0.5) * 400,
      y: () => 400 + Math.random() * 200,
      rotation: () => (Math.random() - 0.5) * config.rotationRange,
      ease: "power1.in"
    }, `+=${config.delayBeforeExplosion}`);

    return () => {
      tl.kill();
    };
  }, [config]);

  return (
    <h1 
      ref={containerRef} 
      className={`text-white text-center whitespace-nowrap ${className}`}
      style={{ 
        fontSize: config.fontSize, 
        fontFamily: config.fontFamily,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'max-content'
      }}
    />
  );
});
