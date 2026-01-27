// Entity modal types

export type EntityType = 'person' | 'proceeding';

export interface EntityModalState {
  type: EntityType;
  id: number;
  context?: {
    caseId?: number;      // For invalidating case queries after edits
    readOnly?: boolean;
  };
}

export interface EntityModalContextValue {
  modalState: EntityModalState | null;
  openModal: (state: EntityModalState) => void;
  closeModal: () => void;
}
