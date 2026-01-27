import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Task } from '../types';

export type DragSourceLocation = 'tasks-page' | 'case-detail' | 'docket-panel' | 'dashboard' | 'case-overview';

interface DragContextValue {
  isDraggingTask: boolean;
  draggedTask: Task | null;
  sourceLocation: DragSourceLocation | null;
  startDrag: (task: Task, source: DragSourceLocation) => void;
  endDrag: () => void;
}

const DragContext = createContext<DragContextValue | undefined>(undefined);

interface DragProviderProps {
  children: ReactNode;
}

export function DragProvider({ children }: DragProviderProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [sourceLocation, setSourceLocation] = useState<DragSourceLocation | null>(null);

  const startDrag = useCallback((task: Task, source: DragSourceLocation) => {
    setDraggedTask(task);
    setSourceLocation(source);
  }, []);

  const endDrag = useCallback(() => {
    setDraggedTask(null);
    setSourceLocation(null);
  }, []);

  return (
    <DragContext.Provider
      value={{
        isDraggingTask: draggedTask !== null,
        draggedTask,
        sourceLocation,
        startDrag,
        endDrag,
      }}
    >
      {children}
    </DragContext.Provider>
  );
}

export function useDragContext(): DragContextValue {
  const context = useContext(DragContext);
  if (context === undefined) {
    throw new Error('useDragContext must be used within a DragProvider');
  }
  return context;
}
