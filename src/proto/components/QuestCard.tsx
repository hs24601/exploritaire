import { useRef } from 'react';
import { holdSlop, useRewardHold, type RewardHold } from '../useRewardHold';
export type QuestCardProps = {
  title: string;
  text: string;
  staminaReward: number;
  /** An unquantified reward, such as energy supplied by tableau cards. */
  rewardLabel?: string;
  complete: boolean;
  redeemed?: boolean;
  onRedeem: () => void;
  rewardHold?: RewardHold;
  /** Tap to show the quest's details; keeps the card interactive while incomplete. */
  onSelect?: () => void;
  selected?: boolean;
};

/** The active quest is a keyboard-accessible reward claim, never an auto-claim. */
export function QuestCard({ title, text, staminaReward, rewardLabel, complete, redeemed = false, onRedeem, rewardHold, onSelect, selected }: QuestCardProps) {
  const ownHold = useRewardHold(onRedeem, complete && !redeemed);
  const hold = rewardHold ?? ownHold;
  const origin = useRef({x:0,y:0});
  return <button type="button" className={`quest-card ${complete ? 'quest-card--complete' : 'quest-card--incomplete'}`}
    disabled={!onSelect && (!complete || redeemed)} aria-haspopup={onSelect ? 'dialog' : undefined} aria-expanded={onSelect ? Boolean(selected) : undefined}
    onClick={event=>{event.preventDefault();onSelect?.();}}
    onPointerDown={rewardHold ? undefined : event=>{if(event.button!==0)return;event.preventDefault();origin.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);hold.start();}}
    onPointerMove={rewardHold ? undefined : event=>{if(Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>holdSlop(event.pointerType))hold.cancel();}}
    onPointerUp={rewardHold ? undefined : hold.cancel} onPointerCancel={rewardHold ? undefined : hold.cancel}
    onKeyDown={event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat&&complete&&!redeemed){event.preventDefault();hold.start();}}}
    onKeyUp={hold.cancel} onBlur={hold.cancel} aria-label={`${title}. ${redeemed ? 'Reward redeemed' : !complete ? `${text}${rewardLabel ? `. Reward: ${rewardLabel}` : ''}` : rewardLabel ? `Complete. Hold for 1 second to redeem ${rewardLabel} and reveal next quest` : staminaReward ? `Complete. Hold for 1 second to redeem ${staminaReward} stamina and reveal next quest` : `${text} Hold for 1 second to clear this card`}`}>
    <span className="quest-card__title">{title}</span>
    <span className="quest-card__text">{text}</span>
    <span className="quest-card__status" role="status">{redeemed ? '✓ Reward redeemed' : !complete ? 'Objective in progress' : staminaReward || rewardLabel ? '✓ Hold 1s to redeem' : '✓ Try it here'}</span>
    {(rewardLabel || staminaReward > 0) && <span className="quest-card__reward"><span aria-hidden="true">⚡</span> {rewardLabel ?? `+${staminaReward} STA`}</span>}
    {hold.progress>0 && <span className="reward-hold-progress" role="progressbar" aria-label="Redeeming reward" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hold.progress*100)}><span style={{["--hold-progress" as string]:`${hold.progress*100}%`}} /></span>}
  </button>;
}
