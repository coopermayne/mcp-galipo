import { useEffect, useRef } from 'react';
import { useEntityModalContext } from '../../context/EntityModalContext';
import { PersonDetailContent } from './PersonDetailContent';
import { ProceedingDetailContent } from './ProceedingDetailContent';
import type { EntityType } from '../../types/modal';

// Registry of entity type to content component
const CONTENT_REGISTRY: Record<
  EntityType,
  React.ComponentType<{
    entityId: number;
    context?: { caseId?: number; readOnly?: boolean };
    onClose: () => void;
  }>
> = {
  person: PersonDetailContent,
  proceeding: ProceedingDetailContent,
};

export function EntityDetailModal() {
  const { modalState, closeModal } = useEntityModalContext();
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (modalState) {
      document.body.style.overflow = 'hidden';
      modalRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalState]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalState) {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [modalState, closeModal]);

  if (!modalState) return null;

  const ContentComponent = CONTENT_REGISTRY[modalState.type];
  if (!ContentComponent) {
    console.error(`Unknown entity type: ${modalState.type}`);
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          tabIndex={-1}
          className="relative w-full max-w-2xl transform rounded-xl bg-white dark:bg-slate-800 shadow-xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <ContentComponent
            entityId={modalState.id}
            context={modalState.context}
            onClose={closeModal}
          />
        </div>
      </div>
    </div>
  );
}
