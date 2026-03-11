import { memo, useEffect, useMemo, useState } from 'react';

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

type TimedWord = {
  word: string;
  durationMs: number;
};

const SENTENCE_END_EXP = /(\.|\?|!)$/;

function buildTimedWords(text: string): TimedWord[] {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => {
      const isSentenceEnd = SENTENCE_END_EXP.test(word);
      let durationMs = Math.max(500, Math.round(word.length * 80));
      if (isSentenceEnd) {
        durationMs += 600;
      }
      return { word, durationMs };
    });
}

export const BarrageTextEffect = memo(function BarrageTextEffect({
  className,
  config = DEFAULT_BARRAGE_TEXT_CONFIG,
}: Props) {
  const timedWords = useMemo(() => buildTimedWords(config.text), [config.text]);
  const [wordIndex, setWordIndex] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);

  useEffect(() => {
    setWordIndex(0);
    setCycleCount(0);
  }, [timedWords, config.delay, config.repeat, config.repeatDelay]);

  useEffect(() => {
    if (timedWords.length === 0) return;

    const current = timedWords[wordIndex] ?? timedWords[0];
    const isLastWord = wordIndex >= timedWords.length - 1;
    const hasInfiniteRepeat = config.repeat < 0;
    const hasRemainingRepeat = cycleCount < config.repeat;
    const delayMs = (wordIndex === 0 && cycleCount === 0)
      ? Math.max(0, Math.round(config.delay * 1000))
      : 0;
    const pauseAfterWordMs = isLastWord ? Math.max(0, Math.round(config.repeatDelay * 1000)) : 0;
    const nextTickMs = delayMs + current.durationMs + pauseAfterWordMs;

    const timeoutId = window.setTimeout(() => {
      if (!isLastWord) {
        setWordIndex((prev) => prev + 1);
        return;
      }
      if (hasInfiniteRepeat || hasRemainingRepeat) {
        setWordIndex(0);
        setCycleCount((prev) => prev + 1);
      }
    }, nextTickMs);

    return () => window.clearTimeout(timeoutId);
  }, [config.delay, config.repeat, config.repeatDelay, cycleCount, timedWords, wordIndex]);

  const currentWord = timedWords[wordIndex]?.word ?? '';
  const currentDurationMs = timedWords[wordIndex]?.durationMs ?? 800;

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className ?? ''}`}
      style={{ perspective: '1000px' }}
    >
      {currentWord ? (
        <h3
          key={`${cycleCount}-${wordIndex}-${currentWord}`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: config.fontSize,
            fontFamily: config.fontFamily,
            color: config.color,
            whiteSpace: 'nowrap',
            margin: 0,
            padding: 0,
            fontWeight: 'bold',
            animationName: 'barrage-text-pulse',
            animationDuration: `${currentDurationMs}ms`,
            animationTimingFunction: 'ease-out',
            animationFillMode: 'both',
          }}
        >
          {currentWord}
        </h3>
      ) : null}
      <style>
        {`
          @keyframes barrage-text-pulse {
            0% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.2);
            }
            22% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.2);
            }
          }
        `}
      </style>
    </div>
  );
});
