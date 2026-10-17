/** Edge handle that brings a stowed tray back: the same leather pull tab as the
 * tray's stow control, under a small drawn emblem saying which tray it is. */
export function TrayRestoreHandle({ tray, onRestore }: { tray: 'quests' | 'supplies'; onRestore: () => void }) {
  const label = tray === 'quests' ? 'Show quest tray' : 'Show supplies tray';
  return <button type="button" className={`tray-restore tray-restore--${tray}`} aria-label={label} title={label} onClick={onRestore}>
    {tray === 'quests' ? <QuestEmblem /> : <SuppliesEmblem />}
    <span className="tray-restore__tab" aria-hidden="true"><span className="pull-tab__grip" /></span>
  </button>;
}

/** A quest card with a wax seal. */
function QuestEmblem() {
  return <svg className="tray-restore__emblem" viewBox="0 0 28 32" aria-hidden="true">
    <rect x="4" y="2" width="20" height="27" rx="3" fill="#5a2f45" stroke="#f3e2b5" strokeWidth="2" />
    <path d="M9 9h10M9 13h10M9 17h6" stroke="#f3e2b5" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
    <circle cx="19" cy="24" r="5" fill="#b8322a" stroke="#5c120e" strokeWidth="1.2" />
    <path d="M17 24l1.4 1.5 2.6-3" stroke="#ffe2ae" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

/** A tied supply sack. */
function SuppliesEmblem() {
  return <svg className="tray-restore__emblem" viewBox="0 0 28 32" aria-hidden="true">
    <path d="M10 8c-5 4-7 9-7 14 0 5 4 8 11 8s11-3 11-8c0-5-2-10-7-14z" fill="#9a6b3c" stroke="#3a2412" strokeWidth="1.6" />
    <path d="M9 4l2 4h6l2-4" fill="#9a6b3c" stroke="#3a2412" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9.5 8.5h9" stroke="#f0c060" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M8 19c3 2 9 2 12 0" stroke="#3a2412" strokeWidth="1.2" fill="none" opacity=".6" />
  </svg>;
}
