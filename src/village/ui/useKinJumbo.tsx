import { ACTOR_HOLO_ART } from '../../proto/art/actorCardArt';
import { useCardJumbo } from '../../proto/components/CardJumbo';
import { ActorCardArt } from '../../proto/components/DetailsCardViewer';
import { TradingCard } from '../../proto/components/TradingCard';
import { KIN_TOKENS, type TokenKin } from '../rules/aspen';
import { KIN } from '../rules/village';
import { KinPortrait } from './KinPortrait';

export function useKinJumbo() {
  const viewer = useCardJumbo();
  return (kin: TokenKin | 'cir', anchor?: HTMLElement, rank?: string | number) => {
    const name = kin === 'cir' ? KIN.cir.name : KIN_TOKENS[kin].name;
    const sprite = ACTOR_HOLO_ART[kin];
    anchor?.focus({ preventScroll: true });
    viewer?.open({ title: name, content: <TradingCard id={`village-${kin}`} title={name} state="jumbo" className="vg-kin-jumbo"
      badge={rank} badgeLabel={rank === undefined ? undefined : `Foundation rank ${rank}`} hideBody
      art={sprite ? <ActorCardArt sprite={sprite} label={name} /> : <div className="vg-jumbo-portrait">
        {kin === 'cir' ? <img src={KIN.cir.portrait} alt="Cir portrait" draggable={false} /> : <KinPortrait kin={kin} label={name} />}
      </div>} /> });
  };
}
