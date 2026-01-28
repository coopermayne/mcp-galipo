import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UndoAction, Toast, UndoContextValue, TaskStatus } from '../types';
import * as api from '../api';

const MAX_HISTORY = 15;
const DEFAULT_TOAST_DURATION = 5000;

const UndoContext = createContext<UndoContextValue | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [history, setHistory] = useState<UndoAction[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const canUndo = history.length > 0;


  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? DEFAULT_TOAST_DURATION;
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto-dismiss after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushUndoAction = useCallback(
    (action: Omit<UndoAction, 'id' | 'timestamp'>) => {
      const fullAction: UndoAction = {
        ...action,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        const newHistory = [fullAction, ...prev];
        return newHistory.slice(0, MAX_HISTORY);
      });

      // Show toast with undo option
      showToast({
        message: action.description,
        undoAction: fullAction,
      });
    },
    [showToast]
  );

  const undo = useCallback(async () => {
    if (history.length === 0) return;

    const action = history[0];
    setHistory((prev) => prev.slice(1));

    try {
      switch (action.entityType) {
        case 'task':
          if (action.actionType === 'delete' && action.deletedEntity) {
            // Recreate the task
            await api.createTask({
              case_id: action.deletedEntity.case_id as number,
              description: action.deletedEntity.description as string,
              status: action.deletedEntity.status as TaskStatus,
              due_date: action.deletedEntity.due_date as string | undefined,
              urgency: action.deletedEntity.urgency as number | undefined,
            });
          } else {
            // Restore previous data
            await api.updateTask(action.entityId, action.previousData);
          }
          break;

        case 'event':
          if (action.actionType === 'delete' && action.deletedEntity) {
            // Recreate the event
            await api.createEvent({
              case_id: action.deletedEntity.case_id as number,
              description: action.deletedEntity.description as string,
              date: action.deletedEntity.date as string,
              time: action.deletedEntity.time as string | undefined,
              location: action.deletedEntity.location as string | undefined,
              calculation_note: action.deletedEntity.calculation_note as string | undefined,
            });
          } else {
            // Restore previous data
            await api.updateEvent(action.entityId, action.previousData);
          }
          break;

        case 'note':
          if (action.actionType === 'delete' && action.deletedEntity) {
            // Recreate the note
            await api.createNote(
              action.deletedEntity.case_id as number,
              action.deletedEntity.content as string
            );
          }
          break;

        case 'case':
          // Only handle updates (not delete - cascades)
          await api.updateCase(action.entityId, action.previousData);
          break;
      }

      // Invalidate relevant queries
      for (const queryKey of action.invalidateKeys) {
        await queryClient.invalidateQueries({ queryKey });
      }

      showToast({ message: 'Undone', duration: 2000 });
    } catch (error) {
      console.error('Undo failed:', error);
      showToast({ message: 'Undo failed', duration: 3000 });
    }
  }, [history, queryClient, showToast]);

  // Keyboard shortcut: Cmd/Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Z (Mac) or Ctrl+Z (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Skip if user is typing in an input or textarea
        const target = e.target as HTMLElement;
        const isEditable =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (isEditable) return;

        // Only prevent default and undo if we have something to undo
        if (canUndo) {
          e.preventDefault();
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, undo]);

  return (
    <UndoContext.Provider
      value={{
        history,
        canUndo,
        pushUndoAction,
        undo,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
}
