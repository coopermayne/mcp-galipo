import { useDroppable } from '@dnd-kit/core';
import { Check, Sun, Sunrise, Clock } from 'lucide-react';
import { useDragContext } from '../../context/DragContext';

interface DropZoneProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  hoverBgColor: string;
}

function DropZone({ id, label, icon, color, bgColor, hoverBgColor }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col items-center justify-center gap-2 p-4 rounded-lg
        border-2 border-dashed transition-all duration-200
        min-h-[80px]
        ${isOver ? `${hoverBgColor} border-solid scale-105 shadow-lg` : `${bgColor} border-slate-300 dark:border-slate-600`}
      `}
    >
      <div className={`${color}`}>{icon}</div>
      <span className={`text-sm font-medium ${color}`}>{label}</span>
    </div>
  );
}

interface GlobalDropZonesProps {
  isDocketOpen: boolean;
}

/**
 * Fixed drop zones on the right edge of the screen.
 * Only shows when dragging from tasks page (not from docket panel).
 */
export function GlobalDropZones({ isDocketOpen }: GlobalDropZonesProps) {
  const { isDraggingTask, sourceLocation } = useDragContext();

  // Only show when dragging from tasks-page or case-detail (not from docket-panel)
  // And only when docket panel is closed
  const shouldShow = isDraggingTask && sourceLocation !== 'docket-panel' && !isDocketOpen;

  if (!shouldShow) {
    return null;
  }

  return (
    <div
      className={`
        fixed right-4 top-1/2 -translate-y-1/2 z-50
        flex flex-col gap-3 p-3
        bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm
        rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700
        transition-all duration-300
        ${isDraggingTask ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'}
      `}
    >
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
        Drop here
      </p>
      <DropZone
        id="drop-done"
        label="Done"
        icon={<Check className="w-5 h-5" />}
        color="text-green-600 dark:text-green-400"
        bgColor="bg-green-50 dark:bg-green-900/20"
        hoverBgColor="bg-green-100 dark:bg-green-900/40 border-green-500"
      />
      <DropZone
        id="drop-today"
        label="Today"
        icon={<Sun className="w-5 h-5" />}
        color="text-amber-600 dark:text-amber-400"
        bgColor="bg-amber-50 dark:bg-amber-900/20"
        hoverBgColor="bg-amber-100 dark:bg-amber-900/40 border-amber-500"
      />
      <DropZone
        id="drop-tomorrow"
        label="Tomorrow"
        icon={<Sunrise className="w-5 h-5" />}
        color="text-blue-600 dark:text-blue-400"
        bgColor="bg-blue-50 dark:bg-blue-900/20"
        hoverBgColor="bg-blue-100 dark:bg-blue-900/40 border-blue-500"
      />
      <DropZone
        id="drop-backburner"
        label="Back Burner"
        icon={<Clock className="w-5 h-5" />}
        color="text-slate-600 dark:text-slate-400"
        bgColor="bg-slate-100 dark:bg-slate-700/50"
        hoverBgColor="bg-slate-200 dark:bg-slate-700 border-slate-500"
      />
    </div>
  );
}
