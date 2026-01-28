/**
 * Pre-configured mutation hooks with automatic undo support.
 *
 * Usage:
 *   const { updateTask, deleteTask } = useTaskMutations(caseId);
 *   updateTask.mutate({ task, field: 'status', value: 'Done' });
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUndo } from '../context/UndoContext';
import * as api from '../api';
import type { Task, Event, Note, Case } from '../types';

// ============================================================================
// Task Mutations
// ============================================================================

interface TaskUpdateVars {
  task: Task;
  field: string;
  value: unknown;
}

interface TaskDeleteVars {
  task: Task;
}

export function useTaskMutations(caseId: number) {
  const queryClient = useQueryClient();
  const { pushUndoAction } = useUndo();

  const invalidateKeys: (string | number)[][] = [['case', caseId], ['tasks'], ['docket'], ['stats']];

  const updateTask = useMutation({
    mutationFn: ({ task, field, value }: TaskUpdateVars) =>
      api.updateTask(task.id, { [field]: value }),
    onSuccess: (_, { task, field, value }) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['docket'] });

      const isStatusToggle = field === 'status';
      const description = isStatusToggle
        ? value === 'Done' ? 'Task completed' : 'Task reopened'
        : `Task ${field} updated`;

      pushUndoAction({
        entityType: 'task',
        entityId: task.id,
        actionType: isStatusToggle ? 'toggle' : 'update',
        description,
        previousData: { [field]: task[field as keyof Task] },
        invalidateKeys,
      });
    },
  });

  const deleteTask = useMutation({
    mutationFn: ({ task }: TaskDeleteVars) => api.deleteTask(task.id),
    onSuccess: (_, { task }) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['docket'] });

      pushUndoAction({
        entityType: 'task',
        entityId: task.id,
        actionType: 'delete',
        description: 'Task deleted',
        previousData: {},
        deletedEntity: {
          case_id: task.case_id,
          description: task.description,
          status: task.status,
          due_date: task.due_date,
          urgency: task.urgency,
        },
        invalidateKeys,
      });
    },
  });

  return { updateTask, deleteTask };
}

// ============================================================================
// Event Mutations
// ============================================================================

interface EventUpdateVars {
  event: Event;
  field: string;
  value: unknown;
}

interface EventDeleteVars {
  event: Event;
}

export function useEventMutations(caseId: number) {
  const queryClient = useQueryClient();
  const { pushUndoAction } = useUndo();

  const invalidateKeys: (string | number)[][] = [['case', caseId], ['events'], ['stats']];

  const updateEvent = useMutation({
    mutationFn: ({ event, field, value }: EventUpdateVars) =>
      api.updateEvent(event.id, { [field]: value }),
    onSuccess: (_, { event, field }) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });

      pushUndoAction({
        entityType: 'event',
        entityId: event.id,
        actionType: 'update',
        description: `Event ${field} updated`,
        previousData: { [field]: event[field as keyof Event] },
        invalidateKeys,
      });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: ({ event }: EventDeleteVars) => api.deleteEvent(event.id),
    onSuccess: (_, { event }) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });

      pushUndoAction({
        entityType: 'event',
        entityId: event.id,
        actionType: 'delete',
        description: 'Event deleted',
        previousData: {},
        deletedEntity: {
          case_id: event.case_id,
          description: event.description,
          date: event.date,
          time: event.time,
          location: event.location,
          calculation_note: event.calculation_note,
        },
        invalidateKeys,
      });
    },
  });

  return { updateEvent, deleteEvent };
}

// ============================================================================
// Note Mutations
// ============================================================================

interface NoteDeleteVars {
  note: Note;
}

export function useNoteMutations(caseId: number) {
  const queryClient = useQueryClient();
  const { pushUndoAction } = useUndo();

  const invalidateKeys: (string | number)[][] = [['case', caseId]];

  const deleteNote = useMutation({
    mutationFn: ({ note }: NoteDeleteVars) => api.deleteNote(note.id),
    onSuccess: (_, { note }) => {
      console.log('[DEBUG] Note delete onSuccess, note:', note);
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });

      console.log('[DEBUG] Calling pushUndoAction for note delete');
      pushUndoAction({
        entityType: 'note',
        entityId: note.id,
        actionType: 'delete',
        description: 'Note deleted',
        previousData: {},
        deletedEntity: {
          case_id: note.case_id,
          content: note.content,
        },
        invalidateKeys,
      });
    },
  });

  return { deleteNote };
}

// ============================================================================
// Case Mutations
// ============================================================================

interface CaseUpdateVars {
  caseData: Case;
  field: string;
  value: string | number | null;
}

export function useCaseMutations(caseId: number) {
  const queryClient = useQueryClient();
  const { pushUndoAction } = useUndo();

  const invalidateKeys: (string | number)[][] = [['case', caseId], ['cases']];

  const updateCase = useMutation({
    mutationFn: ({ field, value }: CaseUpdateVars) =>
      api.updateCase(caseId, { [field]: value }),
    onSuccess: (_, { caseData, field }) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });

      pushUndoAction({
        entityType: 'case',
        entityId: caseId,
        actionType: 'update',
        description: `Case ${field.replace(/_/g, ' ')} updated`,
        previousData: { [field]: caseData[field as keyof Case] },
        invalidateKeys,
      });
    },
  });

  return { updateCase };
}
