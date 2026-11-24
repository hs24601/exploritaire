import { createPortal } from 'react-dom';
import { type AbilityDetail } from '../protoState';

export const AbilityDetailPopup = ({
  detail,
  onClose,
}: {
  detail: AbilityDetail | null;
  onClose: () => void;
}) => {
  if (!detail) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483646] grid place-items-center bg-black/45 px-4 font-mono"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[30rem] rounded-[calc(var(--classic-radius,1rem)*1.1)] border border-[#ffd166]/42 bg-[#090806]/95 p-[clamp(1rem,2.4vmin,1.45rem)] text-white shadow-[0_24px_80px_rgba(0,0,0,0.5),0_0_34px_rgba(255,209,102,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[clamp(0.68rem,1.4vmin,0.86rem)] font-black uppercase tracking-[0.16em] text-[#ffd166]">
              {detail.heroName}
            </div>
            <div className="mt-1 text-[clamp(1.25rem,3vmin,1.8rem)] font-black leading-tight text-[#ffe7ad]">
              {detail.abilityName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/18 bg-white/6 text-[0.86rem] font-black text-white/72 transition hover:border-[#ffd166]/48 hover:text-white"
          >
            X
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[calc(var(--classic-radius,1rem)*0.55)] border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[0.68rem] uppercase tracking-[0.14em] text-white/48">CB</div>
            <div className="mt-1 text-[1.25rem] font-black">{detail.comboCount}</div>
          </div>
          <div className="rounded-[calc(var(--classic-radius,1rem)*0.55)] border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[0.68rem] uppercase tracking-[0.14em] text-white/48">Power</div>
            <div className="mt-1 text-[1.25rem] font-black">{detail.power}</div>
          </div>
          <div className="rounded-[calc(var(--classic-radius,1rem)*0.55)] border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[0.68rem] uppercase tracking-[0.14em] text-white/48">Target</div>
            <div className="mt-1 text-[1.25rem] font-black capitalize">{detail.targetKind}</div>
          </div>
        </div>
        <div className="mt-4 rounded-[calc(var(--classic-radius,1rem)*0.7)] border border-[#8ef2d4]/18 bg-[#8ef2d4]/8 px-4 py-3 text-[clamp(0.9rem,1.8vmin,1.08rem)] leading-snug text-white/86">
          {detail.note}
        </div>
      </div>
    </div>,
    document.body,
  );
};
