/**
 * EventItem - Individual event row component
 *
 * Displays event with inline editing, star toggle, and action buttons.
 */
import { Link } from 'react-router-dom';
import { Star, Trash2 } from 'lucide-react';
import { EditableText, EditableDate, EditableTime, CreateTaskButton } from '../common';
import type { Event } from '../../types';

// Deterministic color mapping for case badges
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

interface EventItemProps {
  event: Event;
  onUpdate: (eventId: number, field: string, value: string | boolean | null) => Promise<void>;
  onDelete: (event: Event) => void;
  onCreateTask?: (event: Event) => void;
  /** Show case badge */
  showCase?: boolean;
  /** Show star toggle button */
  showStar?: boolean;
  /** Show delete button */
  showDelete?: boolean;
  /** Show create task button */
  showCreateTask?: boolean;
  /** Enable inline editing */
  enableEdit?: boolean;
  /** Highlight row (e.g., for overdue) */
  highlight?: boolean;
  /** Compact mode */
  compact?: boolean;
}

export function EventItem({
  event,
  onUpdate,
  onDelete,
  onCreateTask,
  showCase = true,
  showStar = true,
  showDelete = true,
  showCreateTask = true,
  enableEdit = true,
  highlight = false,
  compact = false,
}: EventItemProps) {
  const textSize = compact ? 'text-xs' : 'text-sm';
  const padding = compact ? 'px-2 py-2' : 'px-4 py-3';
  const iconSize = compact ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div
      className={`flex items-center gap-3 ${padding} hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group ${
        highlight ? 'bg-red-50 dark:bg-red-900/20' : ''
      }`}
    >
      {/* Star toggle */}
      {showStar && (
        <button
          onClick={() => onUpdate(event.id, 'starred', !event.starred)}
          className={`p-1 shrink-0 ${
            event.starred ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
          }`}
          title={event.starred ? 'Unstar' : 'Star'}
        >
          <Star className={`${iconSize} ${event.starred ? 'fill-amber-500' : ''}`} />
        </button>
      )}

      {/* Case badge */}
      {showCase && (
        <Link
          to={`/cases/${event.case_id}`}
          className={`px-2 py-0.5 rounded ${textSize} font-medium hover:opacity-80 w-20 truncate text-center shrink-0 ${getCaseColorClass(event.case_id)}`}
          title={event.short_name || event.case_name || `Case #${event.case_id}`}
        >
          {event.short_name || event.case_name || `Case #${event.case_id}`}
        </Link>
      )}

      {/* Description */}
      <div className="flex-1 min-w-0">
        {enableEdit ? (
          <EditableText
            value={event.description}
            onSave={(value) => onUpdate(event.id, 'description', value)}
            className={textSize}
          />
        ) : (
          <span className={`${textSize} text-slate-700 dark:text-slate-300 truncate`}>
            {event.description}
          </span>
        )}
      </div>

      {/* Date and time */}
      <div className="flex items-center gap-0 shrink-0">
        {enableEdit ? (
          <>
            <EditableDate
              value={event.date}
              onSave={(value) => onUpdate(event.id, 'date', value)}
              clearable={false}
            />
            <EditableTime
              value={event.time || null}
              onSave={(value) => onUpdate(event.id, 'time', value)}
            />
          </>
        ) : (
          <span className={`${textSize} text-slate-500`}>
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {event.time && ` ${event.time}`}
          </span>
        )}
      </div>

      {/* Create task button */}
      {showCreateTask && onCreateTask && (
        <CreateTaskButton event={event} onClick={() => onCreateTask(event)} />
      )}

      {/* Delete button */}
      {showDelete && (
        <button
          onClick={() => onDelete(event)}
          className={`p-1 text-slate-400 hover:text-red-400 shrink-0 ${compact ? 'opacity-0 group-hover:opacity-100' : ''}`}
        >
          <Trash2 className={iconSize} />
        </button>
      )}
    </div>
  );
}
