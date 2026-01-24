import { useState, useRef, useEffect, useImperativeHandle, forwardRef, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({ onSend, isLoading }, ref) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !isLoading) {
      onSend(trimmed);
      setValue('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, allow Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 p-3 md:p-4 safe-area-inset-bottom">
      <div className="flex items-end gap-2 md:gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={isLoading}
          rows={1}
          className="
            flex-1 resize-none
            px-4 py-3 md:py-2.5 rounded-xl
            bg-slate-100 dark:bg-slate-700
            text-slate-900 dark:text-slate-100
            placeholder-slate-500 dark:placeholder-slate-400
            border border-transparent
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500
            focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            text-base md:text-sm
            transition-colors
          "
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          className="
            w-12 h-12 md:w-10 md:h-10 rounded-xl
            bg-blue-600 hover:bg-blue-700 active:bg-blue-800
            disabled:bg-slate-300 dark:disabled:bg-slate-600
            disabled:cursor-not-allowed
            text-white
            flex items-center justify-center flex-shrink-0
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            dark:focus:ring-offset-slate-800
          "
          aria-label="Send message"
        >
          <Send className="w-5 h-5 md:w-4 md:h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center hidden md:block">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
});
