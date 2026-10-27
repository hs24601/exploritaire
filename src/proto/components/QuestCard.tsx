import { gameTime } from '../../gameTime';
import { useRef, useState } from 'react';
import { QuestCardEditor, useQuestCardEdit } from './QuestCardEditor';
import { holdSlop, useRewardHold, type RewardHold } from '../useRewardHold';
import { QuestArtwork, QuestEmblem } from './QuestArtwork';
import { useCardJumbo } from './CardJumbo';
import { QuestDescription } from './QuestDescription';
import { QuestProgress } from './QuestProgress';
import type { QuestProgressValue } from '../tutorialQuests';
export type QuestCardProps = {
  authoringId?: string;
  progress?: QuestProgressValue;
  title: string;
  text: string;
  inspirationReward: number;
  /** An unquantified reward, such as energy supplied by tableau cards. */
  rewardLabel?: string;
  statusLabel?: string;
  complete: boolean;
  redeemed?: boolean;
  onRedeem: () => void;
  rewardHold?: RewardHold;
  /** Tap to show the quest's details; keeps the card interactive while incomplete. */
  onSelect?: () => void;
  selected?: boolean;
  jumbo?: boolean;
  artwork?: { sprite: string; paintedSprite?: string };
};

/** The active quest is a keyboard-accessible reward claim, never an auto-claim. */
export function QuestCard({ authoringId, progress, title, text, inspirationReward, rewardLabel, statusLabel, complete, redeemed = false, onRedeem, rewardHold, onSelect, selected, jumbo = false, artwork }: QuestCardProps) {
  const id = authoringId ?? title;
  const edit = useQuestCardEdit(id);
  const [editing, setEditing] = useState(false);
  title = edit?.title ?? title; text = edit?.text ?? text;
  const viewer = useCardJumbo();
  const pressed=useRef({started:0,moved:false});
  const ownHold = useRewardHold(onRedeem, complete && !redeemed);
  const hold = rewardHold ?? ownHold;
  const origin = useRef({x:0,y:0});
  return <><button type="button" className={`quest-card ${complete ? 'quest-card--complete' : 'quest-card--incomplete'}`}
    aria-haspopup={!jumbo && !onSelect ? 'dialog' : undefined} aria-expanded={onSelect ? Boolean(selected) : undefined}
    onClick={event=>{event.preventDefault();if(pressed.current.moved||(pressed.current.started&&gameTime.now()-pressed.current.started>500))return;if(onSelect){onSelect();return;}if(jumbo)return;
      if(viewer){event.currentTarget.focus({preventScroll:true});viewer.open({title,questOrigin:{element:event.currentTarget,bounds:event.currentTarget.getBoundingClientRect()},content:<QuestCard progress={progress} authoringId={id} title={title} text={text} inspirationReward={inspirationReward} rewardLabel={rewardLabel} statusLabel={statusLabel} artwork={artwork} complete={complete} redeemed={redeemed} onRedeem={()=>{viewer.close();onRedeem();}} jumbo />});}}}
    onPointerDown={event=>{pressed.current={started:gameTime.now(),moved:false};origin.current={x:event.clientX,y:event.clientY};if(rewardHold||event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);hold.start();}}
    onPointerMove={event=>{if(Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>holdSlop(event.pointerType)){pressed.current.moved=true;hold.cancel();}}}
    onPointerUp={rewardHold ? undefined : hold.cancel} onPointerCancel={rewardHold ? undefined : hold.cancel}
    onKeyDown={event=>{pressed.current.started=0;pressed.current.moved=false;if(jumbo&&event.key==='Enter'&&!event.repeat&&complete&&!redeemed){event.preventDefault();hold.start();}}}
    onKeyUp={hold.cancel} onBlur={hold.cancel} aria-label={`${title}. ${redeemed ? 'Reward redeemed' : !complete ? `${text}${rewardLabel ? `. Reward: ${rewardLabel}` : ''}` : rewardLabel ? `Complete. Hold for 1 second to redeem ${rewardLabel} and reveal next quest` : inspirationReward ? `Complete. Hold for 1 second to redeem ${inspirationReward} inspiration and reveal next quest` : `${text} Hold for 1 second to clear this card`}`}>
    <span className="quest-card__title"><QuestEmblem />{title}</span>
    <QuestArtwork resting={title === 'Rest'} {...artwork} />
    <QuestDescription text={text} identity={title} />
    <span className="quest-card__update-holo" aria-hidden="true" />
    {progress && <QuestProgress value={progress} />}
    <span className="quest-card__status" role="status">{statusLabel ?? (redeemed ? '✓ Reward redeemed' : !complete ? 'Objective in progress' : inspirationReward || rewardLabel ? '✓ Hold 1s to redeem' : '✓ Try it here')}</span>
    {(rewardLabel || inspirationReward > 0) && <span className="quest-card__reward"><span aria-hidden="true">{inspirationReward > 0 ? '💫' : '⚡'}</span> {rewardLabel ?? `+${inspirationReward} INSP`}</span>}
    {hold.progress>0 && <span className="reward-hold-progress" role="progressbar" aria-label="Redeeming reward" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hold.progress*100)}><span style={{["--hold-progress" as string]:`${hold.progress*100}%`}} /></span>}
  </button>
    {import.meta.env.DEV && jumbo && <button type="button" className="quest-card-edit" data-editor-safe="true" data-camera-ignore="true" data-html2canvas-ignore="true" aria-label="Edit quest card" title="Edit quest card" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setEditing(true); }}>✎</button>}
    {editing && <QuestCardEditor id={id} initial={{ title, text }} onClose={() => setEditing(false)} />}
  </>;
}

