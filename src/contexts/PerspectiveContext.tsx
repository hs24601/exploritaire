import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

export interface PerspectiveContextValue {
  perspectiveEnabled: boolean;
  setPerspectiveEnabled: Dispatch<SetStateAction<boolean>>;
  combatLabPerspectiveHotkeyEnabled: boolean;
  setCombatLabPerspectiveHotkeyEnabled: Dispatch<SetStateAction<boolean>>;
}

const noopSetPerspective: Dispatch<SetStateAction<boolean>> = () => {};
const noopSetCombatLabHotkey: Dispatch<SetStateAction<boolean>> = () => {};

export const PerspectiveContext = createContext<PerspectiveContextValue>({
  perspectiveEnabled: false,
  setPerspectiveEnabled: noopSetPerspective,
  combatLabPerspectiveHotkeyEnabled: false,
  setCombatLabPerspectiveHotkeyEnabled: noopSetCombatLabHotkey,
});

interface PerspectiveProviderProps {
  children: ReactNode;
  combatLabPerspectiveHotkeyEnabled?: boolean;
}

export function PerspectiveProvider({
  children,
  combatLabPerspectiveHotkeyEnabled = false,
}: PerspectiveProviderProps) {
  const [perspectiveEnabled, setPerspectiveEnabled] = useState(false);
  const [combatLabSlashToggleEnabled, setCombatLabSlashToggleEnabled] = useState(combatLabPerspectiveHotkeyEnabled);

  useEffect(() => {
    setCombatLabSlashToggleEnabled(combatLabPerspectiveHotkeyEnabled);
  }, [combatLabPerspectiveHotkeyEnabled]);

  useEffect(() => {
    if (!combatLabSlashToggleEnabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (
        event.key !== '/'
        && event.key !== '?'
        && event.code !== 'Slash'
        && event.code !== 'NumpadDivide'
      ) return;
      if (event.repeat) return;
      event.preventDefault();
      setPerspectiveEnabled((prev) => !prev);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combatLabSlashToggleEnabled]);

  const contextValue = useMemo<PerspectiveContextValue>(() => ({
    perspectiveEnabled,
    setPerspectiveEnabled,
    combatLabPerspectiveHotkeyEnabled: combatLabSlashToggleEnabled,
    setCombatLabPerspectiveHotkeyEnabled: setCombatLabSlashToggleEnabled,
  }), [perspectiveEnabled, combatLabSlashToggleEnabled]);

  return (
    <PerspectiveContext.Provider value={contextValue}>
      {children}
    </PerspectiveContext.Provider>
  );
}

export function usePerspective(): PerspectiveContextValue {
  return useContext(PerspectiveContext);
}
