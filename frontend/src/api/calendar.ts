import type { CalendarItem } from '../types';
import { request } from './common';

export async function getCalendarItems(params: {
  dateFrom: string;
  dateTo: string;
  includeEvents?: boolean;
  includeTasks?: boolean;
  userId?: number;
}): Promise<{ items: CalendarItem[] }> {
  const searchParams = new URLSearchParams();
  searchParams.set('date_from', params.dateFrom);
  searchParams.set('date_to', params.dateTo);
  if (params.includeEvents === false) searchParams.set('include_events', 'false');
  if (params.includeTasks === false) searchParams.set('include_tasks', 'false');
  if (params.userId) searchParams.set('user_id', String(params.userId));
  return request(`/calendar?${searchParams.toString()}`);
}
