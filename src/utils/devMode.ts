import { useEffect, useState } from 'react';

const DEV_MODE_HASH_TOKEN = 'devmode';

export function hasDevModeHash(hash: string): boolean {
  return hash.toLowerCase().includes(DEV_MODE_HASH_TOKEN);
}

export function getIsDevModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return hasDevModeHash(window.location.hash);
}

export function useDevModeFlag(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => getIsDevModeEnabled());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => {
      setEnabled(getIsDevModeEnabled());
    };
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return enabled;
}
