import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SortableTaskRow } from './SortableTaskRow';
import type { Task } from '../../types';

// Deterministic color mapping for case headers
const caseColorClasses = [
  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
];

const getCaseColorClass = (caseId: number) => caseColorClasses[caseId % caseColorClasses.length];

interface CaseGroupProps {
  caseId: number;
  caseName: string;
  shortName?: string;
  tasks: Task[];
  taskStatusOptions: { value: string; label: string }[];
  urgencyOptions: { value: string; label: string }[];
  onUpdate: (taskId: number, field: string, value: any) => void;
  onDelete: (taskId: number, description: string) => void;
  defaultExpanded?: boolean;
  recentlyDroppedId?: number | null;
}

export function CaseGroup({
  caseId,
  caseName,
  shortName,
  tasks,
  taskStatusOptions,
  urgencyOptions,
  onUpdate,
  onDelete,
  defaultExpanded = true,
  recentlyDroppedId,
}: CaseGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { setNodeRef, isOver } = useDroppable({
    id: `case-${caseId}`,
    data: { type: 'case', caseId },
  });

  const taskIds = tasks.map((t) => t.id);
  const colorClass = getCaseColorClass(caseId);

  return (
    <div className="mb-6">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-full flex items-center gap-2 mb-2 px-3 py-2 rounded-lg min-w-0
          ${colorClass}
          hover:opacity-90 transition-opacity
        `}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        <span className="font-semibold text-sm truncate">
          {shortName || caseName}
        </span>
        {shortName && shortName !== caseName && (
          <span className="text-xs opacity-75 truncate hidden sm:inline">
            - {caseName}
          </span>
        )}
        <span className="ml-auto text-xs opacity-75 shrink-0">
          ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
        </span>
      </button>

      {/* Collapsible Container */}
      {isExpanded && (
        <div
          ref={setNodeRef}
          className={`
            rounded-lg border border-slate-200 dark:border-slate-700
            ${isOver ? 'ring-2 ring-primary-500 ring-opacity-50' : ''}
            ${tasks.length === 0 ? 'min-h-[60px] bg-slate-50 dark:bg-slate-800/50' : ''}
          `}
        >
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-[60px] text-sm text-slate-400">
              No tasks
            </div>
          ) : (
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              {tasks.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  taskStatusOptions={taskStatusOptions}
                  urgencyOptions={urgencyOptions}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  showCaseBadge={false}
                  showUrgency={true}
                  isHighlighted={task.id === recentlyDroppedId}
                />
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}
