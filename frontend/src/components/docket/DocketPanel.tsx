import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { X, Calendar, Loader2, Check, LogOut } from 'lucide-react';
import { TodayTaskList } from './TodayTaskList';
import { getTasksForToday, getTasksForTomorrow, getBackburnerTasks, updateTask } from '../../api';
import { useDragContext } from '../../context/DragContext';
import type { Task } from '../../types';

interface DocketPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Droppable section header that allows dropping tasks into it
function DroppableSection({
  id,
  title,
  count,
  children
}: {
  id: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div className="mb-4">
      <div
        ref={setNodeRef}
        className={`
          text-xs font-semibold uppercase tracking-wide px-4 py-2 mb-1
          transition-colors duration-200 rounded-t
          ${isOver
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'text-slate-500 dark:text-slate-400'
          }
        `}
      >
        {title} ({count})
      </div>
      {children}
    </div>
  );
}

// Drop zone for clearing tasks (dragging out of panel)
function ClearDropZone() {
  const { isDraggingTask, sourceLocation } = useDragContext();
  const { isOver, setNodeRef } = useDroppable({ id: 'drop-clear' });

  // Only show when dragging from within the docket panel
  if (!isDraggingTask || sourceLocation !== 'docket-panel') {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        absolute left-0 top-0 bottom-0 w-16 -ml-16
        flex items-center justify-center
        transition-all duration-200
        ${isOver
          ? 'bg-orange-100 dark:bg-orange-900/30 border-r-4 border-orange-500'
          : 'bg-slate-100/50 dark:bg-slate-800/50 border-r-2 border-dashed border-slate-300 dark:border-slate-600'
        }
      `}
    >
      <div className={`flex flex-col items-center gap-1 ${isOver ? 'text-orange-600' : 'text-slate-400'}`}>
        <LogOut className="w-5 h-5 rotate-180" />
        <span className="text-xs font-medium">Clear</span>
      </div>
    </div>
  );
}

// Done drop zone at the bottom
function DoneDropZone() {
  const { isDraggingTask, sourceLocation } = useDragContext();
  const { isOver, setNodeRef } = useDroppable({ id: 'drop-done' });

  // Only show when dragging from within the docket panel
  if (!isDraggingTask || sourceLocation !== 'docket-panel') {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        p-4 border-t border-slate-200 dark:border-slate-700
        flex items-center justify-center gap-2
        transition-all duration-200
        ${isOver
          ? 'bg-green-100 dark:bg-green-900/30'
          : 'bg-slate-50 dark:bg-slate-800/50'
        }
      `}
    >
      <Check className={`w-5 h-5 ${isOver ? 'text-green-600' : 'text-slate-400'}`} />
      <span className={`text-sm font-medium ${isOver ? 'text-green-600' : 'text-slate-400'}`}>
        Drop to mark Done
      </span>
    </div>
  );
}

export function DocketPanel({ isOpen, onClose }: DocketPanelProps) {
  const queryClient = useQueryClient();
  const { startDrag, endDrag, draggedTask } = useDragContext();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const { data: todayData, isLoading: loadingToday } = useQuery({
    queryKey: ['tasks', 'today'],
    queryFn: getTasksForToday,
    enabled: isOpen,
  });

  const { data: tomorrowData, isLoading: loadingTomorrow } = useQuery({
    queryKey: ['tasks', 'tomorrow'],
    queryFn: getTasksForTomorrow,
    enabled: isOpen,
  });

  const { data: backburnerData, isLoading: loadingBackburner } = useQuery({
    queryKey: ['tasks', 'backburner'],
    queryFn: getBackburnerTasks,
    enabled: isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleMarkDone = useCallback(
    (taskId: number) => {
      updateMutation.mutate({ id: taskId, data: { status: 'Done' } });
    },
    [updateMutation]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const allTasks = [
        ...(todayData?.tasks || []),
        ...(tomorrowData?.tasks || []),
        ...(backburnerData?.tasks || []),
      ];
      const task = allTasks.find((t) => t.id === event.active.id);
      if (task) {
        startDrag(task, 'docket-panel');
      }
    },
    [todayData, tomorrowData, backburnerData, startDrag]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      endDrag();

      if (!over) return;

      const overId = over.id.toString();
      const taskId = active.id as number;
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Handle different drop targets
      if (overId === 'drop-done') {
        updateMutation.mutate({ id: taskId, data: { status: 'Done' } });
      } else if (overId === 'drop-clear') {
        // Clear due_date and reset status from Blocked if it was backburner
        updateMutation.mutate({ id: taskId, data: { due_date: '', status: 'Pending' } });
      } else if (overId === 'section-today') {
        updateMutation.mutate({ id: taskId, data: { due_date: today, status: 'Pending' } });
      } else if (overId === 'section-tomorrow') {
        updateMutation.mutate({ id: taskId, data: { due_date: tomorrowStr, status: 'Pending' } });
      } else if (overId === 'section-backburner') {
        updateMutation.mutate({ id: taskId, data: { status: 'Blocked', due_date: '' } });
      }
    },
    [endDrag, updateMutation]
  );

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const isLoading = loadingToday || loadingTomorrow || loadingBackburner;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/20 z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed z-50
          inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0
          w-full md:w-[400px] lg:w-[450px]
          bg-white dark:bg-slate-800
          shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 safe-area-inset-top">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-amber-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 md:w-4 md:h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base md:text-sm font-semibold text-slate-900 dark:text-slate-100">
                Daily Docket
              </h2>
              <p className="text-sm md:text-xs text-slate-500 dark:text-slate-400">
                {todayStr}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 md:p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close docket"
          >
            <X className="w-6 h-6 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Content */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-y-auto py-4 relative">
            {/* Clear drop zone on the left edge */}
            <ClearDropZone />

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <DroppableSection id="section-today" title="Today" count={todayData?.tasks?.length || 0}>
                  <TodayTaskList
                    tasks={todayData?.tasks || []}
                    onMarkDone={handleMarkDone}
                    emptyMessage="No tasks due today"
                  />
                </DroppableSection>

                <DroppableSection id="section-tomorrow" title="Tomorrow" count={tomorrowData?.tasks?.length || 0}>
                  <TodayTaskList
                    tasks={tomorrowData?.tasks || []}
                    onMarkDone={handleMarkDone}
                    emptyMessage="No tasks due tomorrow"
                  />
                </DroppableSection>

                <DroppableSection id="section-backburner" title="Back Burner" count={backburnerData?.tasks?.length || 0}>
                  <TodayTaskList
                    tasks={backburnerData?.tasks || []}
                    onMarkDone={handleMarkDone}
                    emptyMessage="No tasks on back burner"
                  />
                </DroppableSection>
              </>
            )}
          </div>

          {/* Done drop zone at bottom */}
          <DoneDropZone />

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {draggedTask && (
              <div className="shadow-xl rounded-lg overflow-hidden bg-white dark:bg-slate-800 px-3 py-2 flex items-center gap-2 border border-primary-500 max-w-[350px]">
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 truncate max-w-[60px]">
                  {draggedTask.short_name || draggedTask.case_name}
                </span>
                <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
                  {draggedTask.description}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
}
