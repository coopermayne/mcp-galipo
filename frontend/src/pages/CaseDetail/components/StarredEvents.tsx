import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { EditableDate, EditableTime } from '../../../components/common';
import type { Event } from '../../../types';

interface StarredEventsProps {
  events: Event[];
}

export function StarredEvents({ events }: StarredEventsProps) {
  const starredEvents = useMemo(() => events.filter((e) => e.starred), [events]);

  if (starredEvents.length === 0) {
    return null;
  }

  return (
    <>
      {starredEvents.map((event) => (
        <div key={event.id} className="flex items-center gap-4">
          <span className="text-sm text-slate-400 w-32 shrink-0 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            {event.description.length > 20
              ? event.description.substring(0, 20) + '...'
              : event.description}
          </span>
          <div className="flex items-center gap-0">
            <EditableDate
              value={event.date}
              onSave={async () => {}}
              disabled
              className="text-sm"
            />
            <EditableTime value={event.time || null} onSave={async () => {}} disabled />
          </div>
        </div>
      ))}
    </>
  );
}
