import { AUTO_PLAY_SPEED_OPTIONS } from '../protoState';

export const AutoPlayControl = ({
  label,
  paused,
  speedIndex,
  onToggle,
  onSpeedChange,
}: {
  label: string;
  paused: boolean;
  speedIndex: number;
  onToggle: () => void;
  onSpeedChange: (index: number) => void;
}) => (
  <div className="rounded-[calc(var(--classic-radius)*0.55)] border border-white/10 bg-white/5 p-2">
    <div className="mb-1 text-center text-[clamp(0.48rem,1.1vmin,0.64rem)] font-black uppercase tracking-[0.16em] text-white/50">
      {label}
    </div>
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-full border px-2 py-1.5 text-[clamp(0.54rem,1.18vmin,0.7rem)] font-black uppercase tracking-[0.12em] transition ${
        paused
          ? 'border-white/14 bg-black/30 text-white/68 hover:border-[#8ef2d4]/45'
          : 'border-[#8ef2d4]/45 bg-[#8ef2d4]/12 text-[#cafff4]'
      }`}
    >
      {paused ? 'Run' : 'Pause'}
    </button>
    <div className="mt-1 grid grid-cols-4 gap-1">
      {AUTO_PLAY_SPEED_OPTIONS.map((option, optionIndex) => (
        <button
          key={`${label}-${option.label}`}
          type="button"
          onClick={() => onSpeedChange(optionIndex)}
          className={`rounded-full border px-1 py-1 text-[clamp(0.42rem,0.95vmin,0.56rem)] font-black uppercase tracking-[0.08em] transition ${
            speedIndex === optionIndex
              ? 'border-[#ffd166]/50 bg-[#ffd166]/14 text-[#ffe7ad]'
              : 'border-white/10 bg-black/20 text-white/46 hover:border-white/24 hover:text-white/72'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);
