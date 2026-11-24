import { useEffect, useState } from 'react';

/** Compact run options: restart keeps banked progress; purge wipes the save after confirmation. */
export function RunMenu({ onRestart, onPurge, purgeWarning }: { onRestart: () => void; onPurge: () => void; purgeWarning: string }) {
  const [open, setOpen] = useState(false), [confirming, setConfirming] = useState(false);
  const close = () => { setOpen(false); setConfirming(false); };
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.code === 'Escape') close(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [open]);
  return <div className="run-menu">
    <button type="button" className="run-menu__toggle" aria-label="Run options" aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>⋮</button>
    {open && <div className="run-menu__sheet" role="menu" aria-label="Run options">
      {confirming ? <>
        <p>{purgeWarning}</p>
        <div className="run-menu__row">
          <button type="button" role="menuitem" className="run-menu__danger" onClick={() => { onPurge(); close(); }}>Purge</button>
          <button type="button" role="menuitem" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      </> : <>
        <button type="button" role="menuitem" onClick={() => { onRestart(); close(); }}>Restart run</button>
        <button type="button" role="menuitem" onClick={() => setConfirming(true)}>Purge saved progress…</button>
      </>}
    </div>}
  </div>;
}
