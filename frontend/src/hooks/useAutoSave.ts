import { useCallback, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  onSave: (value: T) => Promise<unknown>;
  debounceMs?: number;
}

// Sentinel to indicate no pending save (distinct from null which is a valid value)
const NO_PENDING_SAVE = Symbol('NO_PENDING_SAVE');

export function useAutoSave<T>({ onSave, debounceMs = 300 }: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T | typeof NO_PENDING_SAVE>(NO_PENDING_SAVE);

  const save = useCallback(
    async (value: T) => {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Store the pending value
      pendingValueRef.current = value;

      // Debounce the save
      timeoutRef.current = setTimeout(async () => {
        const valueToSave = pendingValueRef.current;
        if (valueToSave === NO_PENDING_SAVE) return;

        setStatus('saving');
        setError(null);

        try {
          await onSave(valueToSave);
          setStatus('saved');
          // Reset to idle after showing "saved" briefly
          setTimeout(() => setStatus('idle'), 1500);
        } catch (err) {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Save failed');
        }
      }, debounceMs);
    },
    [onSave, debounceMs]
  );

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingValueRef.current = NO_PENDING_SAVE;
    setStatus('idle');
  }, []);

  return { save, cancel, status, error };
}
