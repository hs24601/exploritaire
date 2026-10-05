import { useRef, useState } from 'react';
import { PinnedToast } from './PinnedToast';
import { QuestCard } from './QuestCard';
import { PlayingCardStack } from './PlayingCardStack';

export type QuestDefinition = {
  id: string;
  title: string;
  text: string;
  status: 'incomplete' | 'complete' | 'redeemed';
  rewards: Array<{ kind: 'stamina'; amount: number }>;
};

export function summarizeQuests(quests: QuestDefinition[]) {
  return {
    total: quests.length,
    incomplete: quests.filter((quest) => quest.status === 'incomplete').length,
    complete: quests.filter((quest) => quest.status === 'complete').length,
    redeemed: quests.filter((quest) => quest.status === 'redeemed').length,
    accomplished: quests.filter((quest) => quest.status !== 'incomplete').length,
  };
}

export type QuestFieldProps = {
  quests: QuestDefinition[];
  open?: boolean;
  title?: string;
  subtitle?: string;
  onRedeem: (questId: string) => void;
  onClose?: () => void;
  deployedQuestId?: string;
};

/** Ordered data is authoritative; counts and the active card are derived. */
export function QuestField({ quests, title = 'Expedition Quest', subtitle, onRedeem, onClose, deployedQuestId, open = true }: QuestFieldProps) {
  const counts = summarizeQuests(quests);
  const remaining = quests.filter((quest) => quest.status !== 'redeemed' && quest.id !== deployedQuestId);
  const deployed = quests.find(quest => quest.id === deployedQuestId && quest.status === 'complete');
  const active = remaining[0];
  const ref = useRef<HTMLElement>(null);
  const [noteQuestId, setNoteQuestId] = useState<string | null>(null);
  // The note follows the active card; it closes when that quest leaves the tray.
  const note = open && active && noteQuestId === active.id ? active : undefined;
  return <aside ref={ref} className="proto-quest-sidebar quest-field quest-tray" data-open={open} aria-hidden={!open} inert={!open} aria-label={title}
    data-total={counts.total} data-complete={counts.complete} data-incomplete={counts.incomplete} data-redeemed={counts.redeemed} data-accomplished={counts.accomplished}>
    <header className="quest-field__header">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <span className="quest-tray__progress quest-tray__sr" title={`${counts.complete} ready, ${counts.incomplete} incomplete`} aria-label={`${counts.redeemed} of ${counts.total} redeemed`}>{counts.redeemed}/{counts.total}</span>
      <div className="quest-tray__controls">
        <div className="quest-discard-counter" data-quest-discard="true" data-count={counts.redeemed} aria-label={`Quest discard pile, ${counts.redeemed} cards`}><span className="quest-discard-counter__icon" data-quest-discard-icon="true" aria-hidden="true">✓</span><span title={`${counts.redeemed} of ${counts.total} quests completed`}><span className="quest-tray__sr">Discard </span><strong>{counts.redeemed}</strong><span aria-hidden="true">/{counts.total}</span></span></div>
        <button type="button" className="quest-tray__toggle" aria-label="Stow tray" title="Stow tray" aria-expanded={open} onClick={() => { setNoteQuestId(null); onClose?.(); }}><span className="pull-tab__grip" aria-hidden="true" /></button>
      </div>
    </header>
    <div className="quest-tray__well">
      <div className="quest-foundations">
      <section className="quest-foundation quest-foundation--active" data-quest-slot="1" aria-label="Active quest slot 1">
      <header>Quest 1 <span>{remaining.length} cards</span></header>
      <div className="quest-foundation__cards">
      {active ? <PlayingCardStack overlapStep={0.008} cards={remaining.map((quest, index) => index === 0 ?
        <div key={quest.id} data-quest-id={quest.id} style={{width: '100%', height: '100%'}}><QuestCard title={quest.title} text={quest.text}
          staminaReward={quest.rewards.reduce((sum, reward) => sum + reward.amount, 0)}
          complete={!deployed && quest.status === 'complete'} onRedeem={() => onRedeem(quest.id)}
          selected={note?.id === quest.id} onSelect={() => setNoteQuestId(current => current === quest.id ? null : quest.id)} /></div> :
        <div key={quest.id} className="quest-card-back" data-quest-id={quest.id} aria-hidden="true"></div>
      )} /> : <div className="quest-chain-complete" role="status">{deployed ? 'Collect the final reward on the table' : counts.total ? '✓ Expedition complete · All rewards redeemed' : 'No quests available'}</div>}
      </div>
      </section>
      {[2, 3].map(slot => <section key={slot} className="quest-foundation quest-foundation--disabled" data-quest-slot={slot} aria-disabled="true" aria-label={`Quest slot ${slot} disabled`}><span>Quest {slot}</span><span aria-hidden="true">🔒</span><span>Disabled</span></section>)}
      </div>
    </div>
    {note && <PinnedToast className="quest-note" title={note.title} subtitle={note.status === 'complete' ? 'Complete · hold the card 2s to redeem' : 'Objective in progress'}
      icon="⚡" side="left" anchor={ref.current?.querySelector('[data-quest-slot="1"]') ?? null} edge={ref.current} onClose={() => setNoteQuestId(null)}>
      <p className="quest-note__text">{note.text}</p>
      <p className="quest-note__reward">⚡ +{note.rewards.reduce((sum, reward) => sum + reward.amount, 0)} STA</p>
    </PinnedToast>}
  </aside>;
}
