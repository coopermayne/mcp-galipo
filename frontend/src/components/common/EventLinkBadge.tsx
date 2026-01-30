import { CalendarDays } from 'lucide-react';

interface EventLinkBadgeProps {
  eventDescription?: string;
  eventDate?: string;
}

/**
 * Shows a calendar icon with tooltip when a task is linked to an event.
 * Use this component anywhere tasks are displayed.
 */
export function EventLinkBadge({ eventDescription, eventDate }: EventLinkBadgeProps) {
  if (!eventDescription) return null;

  return (
    <div className="relative group flex-shrink-0">
      <CalendarDays className="w-4 h-4 text-primary-500" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="font-medium">{eventDescription}</div>
        {eventDate && (
          <div className="text-slate-300">
            {new Date(eventDate + 'T00:00:00').toLocaleDateString()}
          </div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
      </div>
    </div>
  );
}
