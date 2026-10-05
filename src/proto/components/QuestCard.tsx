import { useRef } from 'react';
import { useRewardHold, type RewardHold } from '../useRewardHold';
export type QuestCardProps = {
  title: string;
  text: string;
  staminaReward: number;
  complete: boolean;
  redeemed?: boolean;
  onRedeem: () => void;
  rewardHold?: RewardHold;
};

/** The active quest is a keyboard-accessible reward claim, never an auto-claim. */
export function QuestCard({ title, text, staminaReward, complete, redeemed = false, onRedeem, rewardHold }: QuestCardProps) {
  const ownHold = useRewardHold(onRedeem, complete && !redeemed);
  const hold = rewardHold ?? ownHold;
  const origin = useRef({x:0,y:0});
  return <button type="button" className={`quest-card ${complete ? 'quest-card--complete' : 'quest-card--incomplete'}`}
    disabled={!complete || redeemed} onClick={event=>event.preventDefault()}
    onPointerDown={rewardHold ? undefined : event=>{if(event.button!==0)return;event.preventDefault();origin.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);hold.start();}}
    onPointerMove={rewardHold ? undefined : event=>{if(Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>6)hold.cancel();}}
    onPointerUp={rewardHold ? undefined : hold.cancel} onPointerCancel={rewardHold ? undefined : hold.cancel}
    onKeyDown={event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();hold.start();}}}
    onKeyUp={hold.cancel} onBlur={hold.cancel} aria-label={`${title}. ${redeemed ? 'Reward redeemed' : complete ? `Complete. Hold for 2 seconds to redeem ${staminaReward} stamina and reveal next quest` : text}`}>
    <span className="quest-card__title" title={title}>{title}</span>
    <span className="quest-card__text">{text}</span>
    <span className="quest-card__status" role="status">{redeemed ? '✓ Reward redeemed' : complete ? '✓ Hold 2s to redeem' : 'Objective in progress'}</span>
    <span className="quest-card__reward"><span aria-hidden="true">⚡</span> +{staminaReward} STA</span>
    {hold.progress>0 && <span className="reward-hold-progress" role="progressbar" aria-label="Redeeming reward" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hold.progress*100)}><span style={{width:`${hold.progress*100}%`}} /></span>}
  </button>;
}
