/**
 * useEventActions - Hook for common event mutations
 *
 * Provides update, delete, and star mutations with automatic query invalidation.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateEvent, deleteEvent } from '../../api';
import type { Event } from '../../types';

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) =>
      updateEvent(id, data),
    onSuccess: invalidateQueries,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: invalidateQueries,
  });

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
    update: handleUpdate,
    delete: handleDelete,
    toggleStar,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
