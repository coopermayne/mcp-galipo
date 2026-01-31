import type { Event, CreateEventInput, UpdateEventInput } from '../types';
import { request } from './common';

export async function getEvents(params?: {
  limit?: number;
  offset?: number;
  includePast?: boolean;
  pastDays?: number;
  caseId?: number;
}): Promise<{ events: Event[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
  if (params?.includePast) searchParams.set('include_past', 'true');
  if (params?.pastDays) searchParams.set('past_days', String(params.pastDays));
  if (params?.caseId) searchParams.set('case_id', String(params.caseId));
  const query = searchParams.toString();
  return request(`/events${query ? `?${query}` : ''}`);
}

export async function createEvent(
  data: CreateEventInput
): Promise<{ success: boolean; event: Event }> {
  return request('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEvent(
  eventId: number,
  data: UpdateEventInput
): Promise<{ success: boolean; event: Event }> {
  return request(`/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEvent(eventId: number): Promise<{ success: boolean }> {
  return request(`/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function getEventTasks(eventId: number): Promise<{ tasks: { id: number; description: string }[] }> {
  return request(`/events/${eventId}/tasks`);
}

export async function searchEvents(params: {
  query?: string;
  caseId?: number;
  limit?: number;
}): Promise<{ events: Event[] }> {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('q', params.query);
  if (params.caseId) searchParams.set('case_id', String(params.caseId));
  if (params.limit) searchParams.set('limit', String(params.limit));
  const queryStr = searchParams.toString();
  return request(`/events/search${queryStr ? `?${queryStr}` : ''}`);
}
