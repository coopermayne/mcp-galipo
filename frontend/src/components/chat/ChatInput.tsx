import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="border-t border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-end gap-2">
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
            px-4 py-2.5 rounded-xl
            bg-slate-100 dark:bg-slate-700
            text-slate-900 dark:text-slate-100
            placeholder-slate-500 dark:placeholder-slate-400
            border border-transparent
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500
            focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            text-sm
            transition-colors
          "
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          className="
            w-10 h-10 rounded-xl
            bg-blue-600 hover:bg-blue-700
            disabled:bg-slate-300 dark:disabled:bg-slate-600
            disabled:cursor-not-allowed
            text-white
            flex items-center justify-center
            transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            dark:focus:ring-offset-slate-800
          "
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
