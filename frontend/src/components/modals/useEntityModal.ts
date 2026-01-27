import { useCallback } from 'react';
import { useEntityModalContext } from '../../context/EntityModalContext';

export function useEntityModal() {
  const { openModal, closeModal } = useEntityModalContext();

  const openPersonModal = useCallback(
    (id: number, context?: { caseId?: number; readOnly?: boolean }) => {
      openModal({ type: 'person', id, context });
    },
    [openModal]
  );

  const openProceedingModal = useCallback(
    (id: number, context?: { caseId?: number; readOnly?: boolean }) => {
      openModal({ type: 'proceeding', id, context });
    },
    [openModal]
  );

  return {
    openPersonModal,
    openProceedingModal,
    closeModal,
  };
}
