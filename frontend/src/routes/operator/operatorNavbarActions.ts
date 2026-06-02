import { createContext, useContext, type ReactNode } from 'react';

export type OperatorNavbarActions = {
  right?: ReactNode;
};

export type OperatorOutletContext = {
  setNavbarActions: (actions: OperatorNavbarActions) => void;
};

export const OperatorOutletContext = createContext<OperatorOutletContext | null>(null);

export function useOperatorNavbarActions() {
  const context = useContext(OperatorOutletContext);

  if (!context) {
    throw new Error('useOperatorNavbarActions must be used within OperatorLayout');
  }

  return context;
}
