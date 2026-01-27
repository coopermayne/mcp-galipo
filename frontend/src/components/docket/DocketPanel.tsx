import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent, CollisionDetection } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { X, Calendar, Loader2, Check, LogOut } from 'lucide-react';
import { TodayTaskList } from './TodayTaskList';
import { getDocketTasks, updateDocket, updateTask } from '../../api';
import { useDragContext } from '../../context/DragContext';
import type { Task, DocketCategory } from '../../types';

interface DocketPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SectionId = 'section-today' | 'section-tomorrow' | 'section-backburner';

const sectionToCategory: Record<SectionId, DocketCategory> = {
  'section-today': 'today',
  'section-tomorrow': 'tomorrow',
  'section-backburner': 'backburner',
};

// Droppable section header that allows dropping tasks into it
function DroppableSection({
  id,
  title,
  count,
  isOver: isOverProp,
  children
}: {
  id: string;
  title: string;
  count: number;
  isOver?: boolean;
  children: React.ReactNode;
}) {
  const { isOver: isOverDroppable, setNodeRef } = useDroppable({ id });
  const isOver = isOverProp || isOverDroppable;

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

// Drop zone for clearing tasks (removing from docket)
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
        mx-4 mb-4 p-3 rounded-lg
        flex items-center justify-center gap-2
        border-2 border-dashed
        transition-all duration-200
        ${isOver
          ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-500'
          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600'
        }
      `}
    >
      <LogOut className={`w-5 h-5 rotate-180 ${isOver ? 'text-orange-600' : 'text-slate-400'}`} />
      <span className={`text-sm font-medium ${isOver ? 'text-orange-600' : 'text-slate-400'}`}>
        Remove from Docket
      </span>
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

// Custom collision detection that prioritizes drop zones over sortable items
const customCollisionDetection: CollisionDetection = (args) => {
  // First check for pointer collisions (more precise)
  const pointerCollisions = pointerWithin(args);

  // Prioritize special drop zones and section headers
  const priorityIds = ['drop-done', 'drop-clear', 'section-today', 'section-tomorrow', 'section-backburner'];

  const priorityCollision = pointerCollisions.find((collision) =>
    priorityIds.includes(collision.id.toString())
  );

  if (priorityCollision) {
    return [priorityCollision];
  }

  // If no priority collision, check for task collisions
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  // Fall back to rect intersection
  return rectIntersection(args);
};

export function DocketPanel({ isOpen, onClose }: DocketPanelProps) {
  const queryClient = useQueryClient();
  const { startDrag, endDrag, draggedTask } = useDragContext();
  const [overSection, setOverSection] = useState<SectionId | null>(null);

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

  // Fetch all docket tasks in one query
  const { data: docketData, isLoading } = useQuery({
    queryKey: ['docket'],
    queryFn: () => getDocketTasks(true),
    enabled: isOpen,
  });

  const todayTasks = docketData?.today || [];
  const tomorrowTasks = docketData?.tomorrow || [];
  const backburnerTasks = docketData?.backburner || [];

  // Create a map of task ID to section for quick lookup
  const taskSectionMap = useMemo(() => {
    const map = new Map<number, SectionId>();
    todayTasks.forEach((t) => map.set(t.id, 'section-today'));
    tomorrowTasks.forEach((t) => map.set(t.id, 'section-tomorrow'));
    backburnerTasks.forEach((t) => map.set(t.id, 'section-backburner'));
    return map;
  }, [todayTasks, tomorrowTasks, backburnerTasks]);

  // Mutation for updating docket category/order
  const docketMutation = useMutation({
    mutationFn: ({ taskId, category, order }: { taskId: number; category: DocketCategory | null; order?: number }) =>
      updateDocket(taskId, { docket_category: category, docket_order: order }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Mutation for marking tasks as Done
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateTask(id, { status: status as 'Done' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docket'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleMarkDone = useCallback(
    (taskId: number) => {
      statusMutation.mutate({ id: taskId, status: 'Done' });
    },
    [statusMutation]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const allTasks = [...todayTasks, ...tomorrowTasks, ...backburnerTasks];
      // Convert to number since dnd-kit may pass string ids
      const activeId = typeof event.active.id === 'string' ? parseInt(event.active.id, 10) : event.active.id;
      const task = allTasks.find((t) => t.id === activeId);
      if (task) {
        startDrag(task, 'docket-panel');
      }
    },
    [todayTasks, tomorrowTasks, backburnerTasks, startDrag]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) {
        setOverSection(null);
        return;
      }

      const overId = over.id.toString();

      // Check if hovering over a section header
      if (overId.startsWith('section-')) {
        setOverSection(overId as SectionId);
        return;
      }

      // Check if hovering over a task - find which section it belongs to
      const overTaskId = typeof over.id === 'number' ? over.id : parseInt(overId, 10);
      if (!isNaN(overTaskId)) {
        const section = taskSectionMap.get(overTaskId);
        if (section) {
          setOverSection(section);
          return;
        }
      }

      setOverSection(null);
    },
    [taskSectionMap]
  );

  // Calculate new docket_order for insertion at a specific index
  const calculateDocketOrderAtIndex = useCallback((tasks: Task[], insertIndex: number): number => {
    if (tasks.length === 0) return 1000;
    if (insertIndex === 0) return (tasks[0]?.docket_order || 1000) - 500;
    if (insertIndex >= tasks.length) return (tasks[tasks.length - 1]?.docket_order || 0) + 1000;
    const prevTask = tasks[insertIndex - 1];
    const nextTask = tasks[insertIndex];
    return Math.floor(((prevTask?.docket_order || 0) + (nextTask?.docket_order || (prevTask?.docket_order || 0) + 1000)) / 2);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      endDrag();
      setOverSection(null);

      if (!over) return;

      const overId = over.id.toString();
      const taskId = active.id as number;

      // Handle special drop targets first
      if (overId === 'drop-done') {
        statusMutation.mutate({ id: taskId, status: 'Done' });
        return;
      }
      if (overId === 'drop-clear') {
        // Remove from docket
        docketMutation.mutate({ taskId, category: null, order: undefined });
        return;
      }

      // Handle section header drops
      if (overId === 'section-today') {
        const newOrder = calculateDocketOrderAtIndex(todayTasks, todayTasks.length);
        docketMutation.mutate({ taskId, category: 'today', order: newOrder });
        return;
      }
      if (overId === 'section-tomorrow') {
        const newOrder = calculateDocketOrderAtIndex(tomorrowTasks, tomorrowTasks.length);
        docketMutation.mutate({ taskId, category: 'tomorrow', order: newOrder });
        return;
      }
      if (overId === 'section-backburner') {
        const newOrder = calculateDocketOrderAtIndex(backburnerTasks, backburnerTasks.length);
        docketMutation.mutate({ taskId, category: 'backburner', order: newOrder });
        return;
      }

      // Handle dropping on another task (reordering or moving between sections)
      const overTaskId = typeof over.id === 'number' ? over.id : parseInt(overId, 10);
      if (isNaN(overTaskId)) return;

      const activeSection = taskSectionMap.get(taskId);
      const targetSection = taskSectionMap.get(overTaskId);

      if (!targetSection) return;

      // Get the tasks for the target section
      let targetTasks: Task[] = [];
      if (targetSection === 'section-today') {
        targetTasks = todayTasks;
      } else if (targetSection === 'section-tomorrow') {
        targetTasks = tomorrowTasks;
      } else if (targetSection === 'section-backburner') {
        targetTasks = backburnerTasks;
      }

      // Find positions
      const oldIndex = targetTasks.findIndex((t) => t.id === taskId);
      const newIndex = targetTasks.findIndex((t) => t.id === overTaskId);

      const targetCategory = sectionToCategory[targetSection];

      if (activeSection === targetSection) {
        // Same section - just reorder
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reorderedTasks = arrayMove(targetTasks, oldIndex, newIndex);
          const tasksWithoutActive = reorderedTasks.filter((t) => t.id !== taskId);
          const insertIdx = reorderedTasks.findIndex((t) => t.id === taskId);
          const newDocketOrder = calculateDocketOrderAtIndex(tasksWithoutActive, insertIdx);
          docketMutation.mutate({ taskId, category: targetCategory, order: newDocketOrder });
        }
      } else {
        // Different section - move to new section and position
        const tasksWithoutActive = targetTasks.filter((t) => t.id !== taskId);
        const newDocketOrder = calculateDocketOrderAtIndex(tasksWithoutActive, newIndex);
        docketMutation.mutate({ taskId, category: targetCategory, order: newDocketOrder });
      }
    },
    [endDrag, statusMutation, docketMutation, taskSectionMap, todayTasks, tomorrowTasks, backburnerTasks, calculateDocketOrderAtIndex]
  );

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

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
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
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
                <DroppableSection
                  id="section-today"
                  title="Today"
                  count={todayTasks.length}
                  isOver={overSection === 'section-today'}
                >
                  <TodayTaskList
                    tasks={todayTasks}
                    sectionId="section-today"
                    onMarkDone={handleMarkDone}
                    emptyMessage="No tasks scheduled for today"
                  />
                </DroppableSection>

                <DroppableSection
                  id="section-tomorrow"
                  title="Tomorrow"
                  count={tomorrowTasks.length}
                  isOver={overSection === 'section-tomorrow'}
                >
                  <TodayTaskList
                    tasks={tomorrowTasks}
                    sectionId="section-tomorrow"
                    onMarkDone={handleMarkDone}
                    emptyMessage="No tasks scheduled for tomorrow"
                  />
                </DroppableSection>

                <DroppableSection
                  id="section-backburner"
                  title="Back Burner"
                  count={backburnerTasks.length}
                  isOver={overSection === 'section-backburner'}
                >
                  <TodayTaskList
                    tasks={backburnerTasks}
                    sectionId="section-backburner"
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
