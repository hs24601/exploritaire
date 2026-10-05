import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
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
  const wellRef = useRef<HTMLDivElement>(null);
  useFitSlotsToWell(wellRef, open);
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
    <div ref={wellRef} className="quest-tray__well">
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

const SLOT_GAP = 8;
const WELL_PADDING = 6;
const SLOT_LIP = 12;
const MAX_CARD = 150;
const MIN_CARD = 24;
const CARD_RATIO = 63 / 88;

/** Sizes the three identical slots so they always fit the well without
 * scrolling: stacked in a column, or in a row when that gives bigger cards
 * (phone landscape). On desktop the tray's width follows the card, so only
 * the well's height limits it there. The face-up card then clamps its title
 * and objective to the lines that fit; tapping it shows the full text. */
function useFitSlotsToWell(wellRef: RefObject<HTMLDivElement | null>, open: boolean) {
  useLayoutEffect(() => {
    const well = wellRef.current;
    if (!well || !open) return;
    const root = document.documentElement;
    const fitSlots = () => {
      const width = well.clientWidth - WELL_PADDING * 2;
      const height = well.clientHeight - WELL_PADDING * 2;
      if (width <= 0 || height <= 0) return;
      const card = (slotWidth: number, slotHeight: number) => Math.min(slotWidth, slotHeight * CARD_RATIO) - SLOT_LIP;
      const widthFollowsCard = window.matchMedia('(min-width: 901px)').matches;
      const column = card(widthFollowsCard ? Infinity : width, (height - SLOT_GAP * 2) / 3);
      const row = widthFollowsCard ? 0 : card((width - SLOT_GAP * 2) / 3, height);
      const size = Math.floor(Math.max(MIN_CARD, Math.min(MAX_CARD, Math.max(column, row) - 1)));
      well.dataset.slotDirection = row > column ? 'row' : 'column';
      root.style.setProperty('--quest-card-width', `${size}px`);
    };
    const fitText = () => {
      const card = well.querySelector<HTMLElement>('.quest-card');
      const title = card?.querySelector<HTMLElement>('.quest-card__title');
      const text = card?.querySelector<HTMLElement>('.quest-card__text');
      if (!card || !title || !text || card.clientHeight === 0) return;
      const lineHeight = (el: HTMLElement) => parseFloat(getComputedStyle(el).lineHeight) || 18;
      const overflowing = () => card.scrollHeight > card.clientHeight + 1;
      for (let titleLines = 2; titleLines >= 1; titleLines--) {
        title.style.setProperty('--fit-lines', String(titleLines));
        text.hidden = false;
        text.style.removeProperty('--fit-lines');
        const style = getComputedStyle(text);
        const room = text.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        const lines = Math.floor(room / lineHeight(text) + 0.05);
        if (lines < 1) text.hidden = true;
        else text.style.setProperty('--fit-lines', String(lines));
        if (!overflowing()) return;
      }
    };
    const fit = () => { fitSlots(); fitText(); };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(well);
    const observed = new Set<Element>();
    const observeCard = () => { const card = well.querySelector('.quest-card'); if (card && !observed.has(card)) { observed.add(card); resize.observe(card); } };
    observeCard();
    const edits = new MutationObserver(() => { observeCard(); fitText(); });
    edits.observe(well, { childList: true, characterData: true, subtree: true });
    return () => { resize.disconnect(); edits.disconnect(); root.style.removeProperty('--quest-card-width'); };
  }, [wellRef, open]);
}
