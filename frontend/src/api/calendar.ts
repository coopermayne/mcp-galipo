import type { CalendarItem } from '../types';
import { request } from './common';

export async function getCalendarItems(params: {
  dateFrom: string;
  dateTo: string;
  userId?: number;
}): Promise<{ items: CalendarItem[] }> {
  const searchParams = new URLSearchParams();
  searchParams.set('date_from', params.dateFrom);
  searchParams.set('date_to', params.dateTo);
  if (params.userId) searchParams.set('user_id', String(params.userId));
  return request(`/calendar?${searchParams.toString()}`);
}
