import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight } from 'lucide-react';
import type { Task } from '../../types';
import type { ReactNode } from 'react';

interface DraggableTaskRowProps {
  task: Task;
  children: ReactNode;
  className?: string;
}

/**
 * A simple draggable wrapper for task rows.
 * Use this when you need drag-to-docket capability but don't need sorting.
 * Shows the docket indicator (chevron) and drag handle.
 *
 * Must be used inside a DndContext. Handle drag events at the DndContext level.
 */
export function DraggableTaskRow({
  task,
  children,
  className = '',
}: DraggableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 ${isDragging ? 'shadow-lg rounded-lg border border-primary-500' : ''} ${className}`}
    >
      {/* Docket Indicator (fixed width) */}
      <div className="w-3 flex-shrink-0">
        {task.docket_category && (
          <ChevronRight className="w-3 h-3 text-slate-400" />
        )}
      </div>

      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600 dark:hover:text-slate-300"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Task Content */}
      {children}
    </div>
  );
}
