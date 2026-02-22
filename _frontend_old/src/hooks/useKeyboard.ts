import { useCallback } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface UseKeyboardOptions {
  onEnter?: KeyHandler;
  onEscape?: KeyHandler;
  onTab?: KeyHandler;
  enabled?: boolean;
}

export function useKeyboard({
  onEnter,
  onEscape,
  onTab,
  enabled = true,
}: UseKeyboardOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      switch (event.key) {
        case 'Enter':
          if (onEnter) {
            event.preventDefault();
            onEnter(event);
          }
          break;
        case 'Escape':
          if (onEscape) {
            event.preventDefault();
            onEscape(event);
          }
          break;
        case 'Tab':
          if (onTab) {
            onTab(event);
          }
          break;
      }
    },
    [enabled, onEnter, onEscape, onTab]
  );

  return { handleKeyDown };
}
