import { memo, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { EasePack } from 'gsap/EasePack';

gsap.registerPlugin(EasePack);

const DEFAULT_TEXT =
  'one two three four five six seven eight nine ten ' +
  'eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty ' +
  'twenty-one twenty-two twenty-three twenty-four twenty-five ' +
  'twenty-six twenty-seven twenty-eight twenty-nine thirty ' +
  'thirty-one thirty-two thirty-three thirty-four thirty-five ' +
  'thirty-six thirty-seven thirty-eight thirty-nine forty ' +
  'forty-one forty-two forty-three forty-four forty-five ' +
  'forty-six forty-seven forty-eight forty-nine fifty';

export type BarrageTextConfig = {
  text: string;
  repeat: number;
  repeatDelay: number;
  delay: number;
  fontSize: string;
  fontFamily: string;
  color: string;
};

export const DEFAULT_BARRAGE_TEXT_CONFIG: BarrageTextConfig = {
  text: DEFAULT_TEXT,
  repeat: -1,
  repeatDelay: 4,
  delay: 0.6,
  fontSize: '4rem',
  fontFamily: 'system-ui, sans-serif',
  color: '#ffffff',
};

type Props = {
  className?: string;
  config?: BarrageTextConfig;
};

export const BarrageTextEffect = memo(function BarrageTextEffect({
  className,
  config = DEFAULT_BARRAGE_TEXT_CONFIG,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const _sentenceEndExp = /(\.|\?|!)$/;

    const words = config.text.split(' ');
    const tl = gsap.timeline({
      delay: config.delay,
      repeat: config.repeat,
      repeatDelay: config.repeatDelay,
    });

    let time = 0;
    const elements: HTMLElement[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const isSentenceEnd = _sentenceEndExp.test(word);
      let duration = Math.max(0.5, word.length * 0.08);

      if (isSentenceEnd) {
        duration += 0.6;
      }

      const el = document.createElement('h3');
      el.textContent = word;
      Object.assign(el.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        color: config.color,
        whiteSpace: 'nowrap',
        margin: '0',
        padding: '0',
        fontWeight: 'bold',
      });
      container.appendChild(el);
      elements.push(el);

      gsap.set(el, { autoAlpha: 0, scale: 0, z: 0.01 });

      tl.to(el, { duration, scale: 1.2, ease: 'slow(0.25, 0.9)' }, time)
        .to(el, { duration, autoAlpha: 1, ease: 'slow(0.25, 0.9, true)' }, time);

      time += duration - 0.05;

      if (isSentenceEnd) {
        time += 0.6;
      }
    }

    return () => {
      tl.kill();
      elements.forEach(el => el.remove());
    };
  }, [config]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className ?? ''}`}
      style={{ perspective: '1000px' }}
    />
  );
});
