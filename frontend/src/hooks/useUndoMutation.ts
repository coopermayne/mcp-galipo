import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions, QueryKey } from '@tanstack/react-query';
import { useUndo } from '../context/UndoContext';
import type { UndoEntityType, UndoActionType } from '../types';

interface UndoMutationOptions<TData, TVariables> extends Omit<UseMutationOptions<TData, Error, TVariables>, 'onSuccess'> {
  // Undo configuration
  entityType: UndoEntityType;
  getEntityId: (variables: TVariables) => number;
  getDescription: (variables: TVariables, isDelete?: boolean) => string;
  getActionType?: (variables: TVariables) => UndoActionType;

  // For updates: query key to read previous state from cache
  // e.g., ['case', caseId] or (vars) => ['case', vars.caseId]
  previousDataQueryKey?: QueryKey | ((variables: TVariables) => QueryKey);

  // For updates: how to extract the entity from cached data
  // e.g., (caseData, vars) => caseData.tasks.find(t => t.id === vars.id)
  extractEntity?: (cachedData: unknown, variables: TVariables) => Record<string, unknown> | undefined;

  // For deletes: the full entity to store for recreation
  getDeletedEntity?: (variables: TVariables) => Record<string, unknown>;

  // Query keys to invalidate after undo
  invalidateKeys: QueryKey[] | ((variables: TVariables) => QueryKey[]);

  // Original onSuccess if needed
  onSuccess?: (data: TData, variables: TVariables) => void;
}

export function useUndoMutation<TData, TVariables>({
  entityType,
  getEntityId,
  getDescription,
  getActionType,
  previousDataQueryKey,
  extractEntity,
  getDeletedEntity,
  invalidateKeys,
  onSuccess,
  ...mutationOptions
}: UndoMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const { pushUndoAction } = useUndo();

  return useMutation<TData, Error, TVariables, { previousData?: Record<string, unknown> }>({
    ...mutationOptions,

    // Capture previous state before mutation
    onMutate: async (variables) => {
      let previousData: Record<string, unknown> | undefined;

      if (previousDataQueryKey && extractEntity) {
        const queryKey = typeof previousDataQueryKey === 'function'
          ? previousDataQueryKey(variables)
          : previousDataQueryKey;
        const cachedData = queryClient.getQueryData(queryKey);
        if (cachedData) {
          previousData = extractEntity(cachedData, variables);
        }
      }

      return { previousData };
    },

    onSuccess: (data, variables, context) => {
      const entityId = getEntityId(variables);
      const description = getDescription(variables);
      const actionType = getActionType?.(variables) ?? 'update';
      const keys = typeof invalidateKeys === 'function'
        ? invalidateKeys(variables)
        : invalidateKeys;

      const undoAction: Parameters<typeof pushUndoAction>[0] = {
        entityType,
        entityId,
        actionType,
        description,
        previousData: context?.previousData ?? {},
        invalidateKeys: keys as (string | number)[][],
      };

      // For deletes, include the full entity for recreation
      if (actionType === 'delete' && getDeletedEntity) {
        undoAction.deletedEntity = getDeletedEntity(variables);
      }

      pushUndoAction(undoAction);

      // Call original onSuccess if provided
      onSuccess?.(data, variables);
    },
  });
}

// Simpler version for cases where you already have the previous data
interface SimpleUndoOptions {
  entityType: UndoEntityType;
  entityId: number;
  description: string;
  actionType?: UndoActionType;
  previousData: Record<string, unknown>;
  deletedEntity?: Record<string, unknown>;
  invalidateKeys: (string | number)[][];
}

export function usePushUndo() {
  const { pushUndoAction } = useUndo();

  return (options: SimpleUndoOptions) => {
    pushUndoAction({
      entityType: options.entityType,
      entityId: options.entityId,
      actionType: options.actionType ?? 'update',
      description: options.description,
      previousData: options.previousData,
      deletedEntity: options.deletedEntity,
      invalidateKeys: options.invalidateKeys,
    });
  };
}
