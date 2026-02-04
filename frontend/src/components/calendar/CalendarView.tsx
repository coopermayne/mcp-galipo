import { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCalendarItems } from '../../api/calendar';
import type { CalendarItem } from '../../types';
import type { CalendarViewMode } from '../../types/panel-layout';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar-overrides.css';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const ALLOWED_VIEWS: View[] = ['month', 'agenda'];

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  caseId: number;
  caseColor?: string;
}

function itemToEvent(item: CalendarItem): CalendarEvent {
  const caseName = item.short_name || item.case_name;
  const title = `${caseName}: ${item.description}`;

  let start: Date;
  let allDay = true;

  if (item.time) {
    const [hours, minutes] = item.time.split(':').map(Number);
    start = new Date(item.date + 'T00:00:00');
    start.setHours(hours, minutes, 0, 0);
    allDay = false;
  } else {
    start = new Date(item.date + 'T00:00:00');
  }

  const end = allDay ? start : new Date(start.getTime() + 60 * 60 * 1000);

  return { id: item.id, title, start, end, allDay, caseId: item.case_id, caseColor: item.case_color };
}

// Muted color palette for calendar events
const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  red: { bg: '#fee2e2', text: '#991b1b' },
  orange: { bg: '#ffedd5', text: '#9a3412' },
  amber: { bg: '#fef3c7', text: '#92400e' },
  yellow: { bg: '#fef9c3', text: '#854d0e' },
  lime: { bg: '#ecfccb', text: '#3f6212' },
  green: { bg: '#dcfce7', text: '#166534' },
  emerald: { bg: '#d1fae5', text: '#065f46' },
  teal: { bg: '#ccfbf1', text: '#115e59' },
  cyan: { bg: '#cffafe', text: '#155e75' },
  sky: { bg: '#e0f2fe', text: '#075985' },
  blue: { bg: '#dbeafe', text: '#1e40af' },
  indigo: { bg: '#e0e7ff', text: '#3730a3' },
  violet: { bg: '#ede9fe', text: '#5b21b6' },
  purple: { bg: '#f3e8ff', text: '#6b21a8' },
  fuchsia: { bg: '#fae8ff', text: '#86198f' },
  pink: { bg: '#fce7f3', text: '#9d174d' },
  rose: { bg: '#ffe4e6', text: '#9f1239' },
  slate: { bg: '#e2e8f0', text: '#334155' },
};

const DEFAULT_COLOR = { bg: '#e0e7ff', text: '#3730a3' };

function getColors(caseColor?: string) {
  return caseColor ? (COLOR_MAP[caseColor] || DEFAULT_COLOR) : DEFAULT_COLOR;
}

/** Custom agenda event component - shows colored dot instead of full-row background */
function AgendaEvent({ event }: { event: CalendarEvent }) {
  const colors = getColors(event.caseColor);
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: colors.text }}
      />
      <span>{event.title}</span>
    </span>
  );
}

interface CalendarViewProps {
  calendarView: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
}

export function CalendarView({ calendarView, onViewChange }: CalendarViewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { dateFrom, dateTo } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return {
      dateFrom: format(addDays(monthStart, -7), 'yyyy-MM-dd'),
      dateTo: format(addDays(monthEnd, 7), 'yyyy-MM-dd'),
    };
  }, [currentDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', dateFrom, dateTo, user?.id],
    queryFn: () =>
      getCalendarItems({
        dateFrom,
        dateTo,
        userId: user?.id,
      }),
    enabled: !!user,
  });

  const events = useMemo(() => {
    if (!data?.items) return [];
    return data.items.map(itemToEvent);
  }, [data]);

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const colors = getColors(event.caseColor);
    return {
      style: {
        backgroundColor: colors.bg,
        color: colors.text,
        borderLeft: `3px solid ${colors.text}`,
      },
    };
  }, []);

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      navigate(`/cases/${event.caseId}`);
    },
    [navigate]
  );

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleViewChange = useCallback(
    (view: View) => {
      onViewChange(view as CalendarViewMode);
    },
    [onViewChange]
  );

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Loading calendar...
      </div>
    );
  }

  return (
    <Calendar<CalendarEvent>
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      allDayAccessor="allDay"
      views={ALLOWED_VIEWS}
      view={calendarView}
      onView={handleViewChange}
      date={currentDate}
      onNavigate={handleNavigate}
      onSelectEvent={handleSelectEvent}
      eventPropGetter={eventPropGetter}
      components={{
        agenda: { event: AgendaEvent },
      }}
      popup
      style={{ height: '100%' }}
    />
  );
}
