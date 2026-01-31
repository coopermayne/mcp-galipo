/**
 * useTaskActions - Unified hook for all task mutations
 *
 * Centralizes task CRUD operations so they're consistent everywhere.
 * Pass additional query keys to invalidate when mutations succeed.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTask, deleteTask, createTask, reorderTask } from '../../api';
import type { Task } from '../../types';

interface UseTaskActionsOptions {
  /** Additional query keys to invalidate on success */
  invalidateKeys?: string[][];
}

export function useTaskActions(options: UseTaskActionsOptions = {}) {
  const queryClient = useQueryClient();
  const { invalidateKeys = [] } = options;

  const invalidateAll = () => {
    // Always invalidate these
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    // Events need refresh too (task_count, linked tasks)
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-events'] });

    // Plus any custom keys passed in
    invalidateKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  };

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      updateTask(id, data),
    onSuccess: invalidateAll,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: invalidateAll,
  });

  const create = useMutation({
    mutationFn: (data: { case_id: number; description: string; urgency?: number; due_date?: string }) =>
      createTask(data),
    onSuccess: invalidateAll,
  });

  const reorder = useMutation({
    mutationFn: ({ taskId, sortOrder, urgency }: { taskId: number; sortOrder: number; urgency?: number }) =>
      reorderTask(taskId, sortOrder, urgency),
    onSuccess: invalidateAll,
  });

  // Convenience methods that wrap the mutations
  const updateField = async (taskId: number, field: keyof Task, value: unknown) => {
    await update.mutateAsync({ id: taskId, data: { [field]: value } as Partial<Task> });
  };

  const markDone = async (taskId: number) => {
    await update.mutateAsync({ id: taskId, data: { status: 'Done' } });
  };

  return {
    // Raw mutations (for when you need isPending, etc.)
    mutations: {
      update,
      remove,
      create,
      reorder,
    },
    // Convenience methods
    updateField,
    markDone,
    deleteTask: remove.mutateAsync,
    createTask: create.mutateAsync,
    // Loading states
    isUpdating: update.isPending,
    isDeleting: remove.isPending,
    isCreating: create.isPending,
  };
}
