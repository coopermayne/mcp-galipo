// Undo system types

export type UndoEntityType = 'task' | 'event' | 'note' | 'case';
export type UndoActionType = 'update' | 'delete' | 'toggle';

export interface UndoAction {
  id: string;
  timestamp: number;
  entityType: UndoEntityType;
  entityId: number;
  actionType: UndoActionType;
  description: string; // Human-readable, e.g., "Task marked complete"
  previousData: Record<string, unknown>;
  deletedEntity?: Record<string, unknown>; // For recreating deleted entities
  invalidateKeys: (string | number)[][]; // Query keys to invalidate after undo
}

export interface Toast {
  id: string;
  message: string;
  undoAction?: UndoAction; // If present, shows "Undo" button
  duration?: number; // Auto-dismiss in ms (default 5000)
}

export interface UndoContextValue {
  history: UndoAction[];
  canUndo: boolean;
  pushUndoAction: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void;
  undo: () => Promise<void>;
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}
