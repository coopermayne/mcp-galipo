import type { Note } from '../types';
import { request } from './common';

export async function createNote(
  caseId: number,
  content: string
): Promise<{ success: boolean; note: Note }> {
  return request('/notes', {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId, content }),
  });
}

export async function updateNote(
  noteId: number,
  content: string
): Promise<{ success: boolean; note: Note }> {
  return request(`/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function deleteNote(noteId: number): Promise<{ success: boolean }> {
  return request(`/notes/${noteId}`, {
    method: 'DELETE',
  });
}
