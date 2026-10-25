import './MomentumIcon.css';

/** Shared currency mark; the comet distinguishes incoming Momentum receipts. */
export function MomentumIcon({ variant = 'reserve', className = '' }: { variant?: 'reserve' | 'gain'; className?: string }) {
  const file = variant === 'gain' ? 'comet-spark' : 'spiraling-ember';
  return <img className={`momentum-icon ${className}`} src={`${import.meta.env.BASE_URL}assets/runtime/ui/momentum/${file}-v1.png`} alt="" aria-hidden="true" draggable={false} />;
}
