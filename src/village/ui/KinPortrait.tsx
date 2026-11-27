import { KeruExpression } from '../../proto/components/KeruExpression';
import { KIN_TOKENS, type TokenKin } from '../rules/aspen';

export function KinPortrait({ kin, label = '' }: { kin: TokenKin; label?: string }) {
  return <span className="vg-kin-portrait" aria-hidden={label ? undefined : true}>
    {kin === 'demi' ? <KeruExpression keru="dem" demi emotion="happy" label={label} /> :
      <img src={KIN_TOKENS[kin].portrait} alt={label} draggable={false} />}
  </span>;
}
