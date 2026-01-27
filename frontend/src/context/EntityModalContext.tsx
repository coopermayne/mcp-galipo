import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { EntityModalState, EntityModalContextValue } from '../types/modal';

const EntityModalContext = createContext<EntityModalContextValue | null>(null);

export function EntityModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<EntityModalState | null>(null);

  const openModal = useCallback((state: EntityModalState) => {
    setModalState(state);
  }, []);

  const closeModal = useCallback(() => {
    setModalState(null);
  }, []);

  return (
    <EntityModalContext.Provider value={{ modalState, openModal, closeModal }}>
      {children}
    </EntityModalContext.Provider>
  );
}

export function useEntityModalContext(): EntityModalContextValue {
  const context = useContext(EntityModalContext);
  if (!context) {
    throw new Error('useEntityModalContext must be used within an EntityModalProvider');
  }
  return context;
}
