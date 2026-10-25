import { TradingCard, type TradingCardProps } from './TradingCard';
import './AbilityCardFace.css';

/** Shared ability holocard. Its owner retains all press, drag and cast input. */
export function AbilityCardFace({ animated = true, ...props }: Omit<TradingCardProps, 'interactive' | 'motionFromParent' | 'className' | 'finish'> & { animated?: boolean }) {
  return <TradingCard {...props} finish="diagonal-holo" interactive={false} motionFromParent={animated} className="ability-holo-stage" />;
}

/** Reuse the painted night sky; keep the cutout separate for depth/extrusion. */
export function KeruAbilityArt({ subject, label, background = `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png` }: { subject: string; label: string; background?: string }) {
  return <div className="ability-keru-art" role="img" aria-label={label}>
    <div className="ability-keru-art__sky"><img src={background} alt="" draggable={false} /></div>
    <img className="ability-keru-art__subject" src={subject} alt="" draggable={false} />
  </div>;
}
