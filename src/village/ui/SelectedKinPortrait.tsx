import { ACTOR_HOLO_ART, ACTOR_HOLO_LAYERS } from '../../proto/art/actorCardArt';
import { KIN_TOKENS, type TokenKin } from '../rules/aspen';
import { KinPortrait } from './KinPortrait';
import { useKinJumbo } from './useKinJumbo';

export function SelectedKinPortrait({ kin }: { kin: TokenKin }) {
  const inspect = useKinJumbo();
  const name = KIN_TOKENS[kin].name;
  const subject = ACTOR_HOLO_LAYERS[ACTOR_HOLO_ART[kin]]?.subject;
  return <aside className="vg-selected-kin" aria-label="Selected kin">
    <button type="button" aria-label={`Inspect ${name}`} aria-haspopup="dialog" title={`Open ${name}'s holocard`}
      onClick={event => inspect(kin, event.currentTarget)}>
      <span className="vg-selected-kin-art">
        {kin === 'hero' ? <span className="vg-selected-hero-bust" aria-hidden="true" />
          : subject ? <img src={subject} alt="" draggable={false} /> : <KinPortrait kin={kin} />}
      </span>
      <strong>{name}</strong>
    </button>
  </aside>;
}
