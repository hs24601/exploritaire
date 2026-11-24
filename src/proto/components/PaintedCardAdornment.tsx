type PaintedElement = 'nature' | 'fire' | 'water' | 'air' | 'earth' | 'chaos';

/** Separate authored paint from ranks, input and accessible suit names. */
export function PaintedCardAdornment({ element }: { element: PaintedElement }) {
  return <img
    className={`painted-card-adornment ${element}-card-adornment`}
    src={`${import.meta.env.BASE_URL}assets/runtime/ui/card-adornments/${element}-v4.png`}
    alt=""
    aria-hidden="true"
    draggable={false}
  />;
}
