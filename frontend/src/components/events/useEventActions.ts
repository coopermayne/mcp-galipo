/**
 * useEventActions - Hook for common event mutations
 *
 * Provides update, delete, and star mutations with automatic query invalidation.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEvent, updateEvent, deleteEvent } from '../../api';
import type { Event, CreateEventInput } from '../../types';

interface UseEventActionsOptions {
  /** Additional query keys to invalidate on success */
  invalidateKeys?: string[][];
}

export function useEventActions({ invalidateKeys = [] }: UseEventActionsOptions = {}) {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-events'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    invalidateKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateEventInput) => createEvent(data),
    onSuccess: invalidateQueries,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) =>
      updateEvent(id, data),
    onSuccess: invalidateQueries,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: invalidateQueries,
  });

  const handleCreate = async (data: CreateEventInput) => {
    return createMutation.mutateAsync(data);
  };

  const handleUpdate = async (eventId: number, updates: Partial<Event>) => {
    return updateMutation.mutateAsync({ id: eventId, data: updates });
  };

  const handleDelete = async (eventId: number) => {
    return deleteMutation.mutateAsync(eventId);
  };

  const toggleStar = async (event: Event) => {
    return handleUpdate(event.id, { starred: !event.starred });
  };

  return {
    create: handleCreate,
    update: handleUpdate,
    delete: handleDelete,
    toggleStar,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
