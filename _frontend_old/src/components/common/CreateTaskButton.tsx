import { ListTodo } from 'lucide-react';
import type { Event } from '../../types';

interface CreateTaskButtonProps {
  event: Event;
  onClick: () => void;
}

/**
 * Button to create a task from an event.
 * Shows task count badge when tasks are linked to the event.
 * Use this component anywhere events are displayed.
 */
export function CreateTaskButton({ event, onClick }: CreateTaskButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-1 text-text-muted hover:text-primary-500"
      title="Create task from event"
    >
      <ListTodo className="w-4 h-4" />
      {(event.task_count ?? 0) > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center text-[10px] font-medium bg-primary-500 text-white rounded-full px-0.5">
          {event.task_count}
        </span>
      )}
    </button>
  );
}
