import { createContext, useContext } from 'react';

const CardScaleContext = createContext(1);

export function CardScaleProvider({
  value,
  children,
}: {
  value: number;
  children: React.ReactNode;
}) {
  return (
    <CardScaleContext.Provider value={value}>
      {children}
    </CardScaleContext.Provider>
  );
}

export function useCardScale(): number {
  return useContext(CardScaleContext);
}
