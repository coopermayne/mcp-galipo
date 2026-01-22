import type { Event, CreateEventInput, UpdateEventInput } from '../types';
import { request } from './common';

export async function getEvents(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ events: Event[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));
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
