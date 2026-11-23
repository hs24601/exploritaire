import { TradingCard, type TradingCardProps } from './TradingCard';
import { LayeredCardArt } from './LayeredCardArt';
import './AbilityCardFace.css';

/** Shared ability holocard. Its owner retains all press, drag and cast input. */
export function AbilityCardFace({ animated = true, ...props }: Omit<TradingCardProps, 'interactive' | 'motionFromParent' | 'className' | 'finish'> & { animated?: boolean }) {
  const jumbo = props.state === 'jumbo';
  return <TradingCard {...props} hideBody descriptionTooltip={false} finish="diagonal-holo" interactive={animated && jumbo} motionFromParent={animated && !jumbo} className="ability-holo-stage" />;
}

/** Reuse the painted night sky; keep the cutout separate for depth/extrusion. */
export function KeruAbilityArt({ subject, label, background = `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png` }: { subject: string; label: string; background?: string }) {
  return <LayeredCardArt background={background} subject={subject} label={label} variant="ability" windstorm={subject.includes('/keru/cir/')} />;
}
