import { memo, useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export type FloatAwayTextConfig = {
  text: string;
  fontSize: string;
  entranceDuration: number;
  entranceRotation: number;
  entranceEase: string;
  floatDelay: number;
  minSpeed: number;
  maxSpeed: number;
};

export const DEFAULT_FLOAT_AWAY_TEXT_CONFIG: FloatAwayTextConfig = {
  text: "Floating!",
  fontSize: "80px",
  entranceDuration: 2.5,
  entranceRotation: 90,
  entranceEase: "elastic.out(1, 0.3)",
  floatDelay: 1.5,
  minSpeed: 0.5,
  maxSpeed: 2.0,
};

type Props = {
  config?: FloatAwayTextConfig;
};

export const FloatAwayTextEffect = memo(function FloatAwayTextEffect({ 
  config = DEFAULT_FLOAT_AWAY_TEXT_CONFIG 
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!textRef.current || !containerRef.current) return;

    const chars = textRef.current.querySelectorAll('.char');
    if (!chars.length) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const vw = bounds.width || window.innerWidth;
    const vh = bounds.height || window.innerHeight;

    gsap.killTweensOf(chars);
    gsap.set(chars, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });

    // 1. Entrance Animation (Runs Once)
    const entranceTl = gsap.timeline();
    entranceTl.from(chars, {
      duration: config.entranceDuration,
      y: 100,
      rotation: config.entranceRotation,
      opacity: 0,
      scale: 0,
      ease: config.entranceEase,
      stagger: 0.05,
      onComplete: () => {
        // Optional: Do something when they all arrive
      }
    });

    // 2. Continuous Floating Loop
    chars.forEach((char, i) => {
      const speed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);
      const duration = 10 + (1 / speed) * 15;
      const delay = config.floatDelay + (i * 0.1);
      const rotations = Math.random() * 2 + 1;

      // Random direction vectors
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;

      gsap.to(char, {
        x: (vw * 0.4 * dirX) + (Math.random() * 100 * dirX),
        y: (vh * 0.4 * dirY) + (Math.random() * 100 * dirY),
        rotation: 360 * rotations,
        opacity: 0,
        duration: duration,
        delay: delay,
        ease: "power1.inOut",
        repeat: -1,
        repeatDelay: Math.random() * 2,
        onRepeat: function() {
          // Reset to center before next float
          gsap.set(char, { 
            x: 0, 
            y: 0, 
            rotation: 0, 
            opacity: 1,
            scale: 1 
          });
        }
      });
    });

    return () => {
      gsap.killTweensOf(chars);
      entranceTl.kill();
    };
  }, [config]);

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      <h1 
        ref={textRef}
        className="text-white opacity-100 whitespace-nowrap text-center select-none"
        style={{ 
          fontFamily: '"Rubik Scribble", "Arial Black", sans-serif',
          fontSize: config.fontSize,
          perspective: '1000px'
        }}
      >
        {config.text.split('').map((char, i) => (
          <span 
            key={i} 
            className="char inline-block"
            style={{ 
              display: char === ' ' ? 'inline' : 'inline-block',
              willChange: 'transform, opacity'
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </h1>
    </div>
  );
});
