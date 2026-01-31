/**
 * Chat suggestions component.
 *
 * Shows suggested questions for the current mode.
 */

import { Lightbulb } from 'lucide-react';
import { type ChatMode, CHAT_MODES, getModeColorClasses } from '../../config/chatModes';

interface ChatSuggestionsProps {
  mode: ChatMode;
  onSelectQuestion: (question: string) => void;
}

export function ChatSuggestions({ mode, onSelectQuestion }: ChatSuggestionsProps) {
  const modeConfig = CHAT_MODES[mode];
  const suggestions = modeConfig?.suggestedQuestions || [];

  if (suggestions.length === 0) {
    return null;
  }

  const colors = getModeColorClasses(modeConfig.color);

  return (
    <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Suggested questions
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.slice(0, 3).map((question, index) => (
          <button
            key={index}
            onClick={() => onSelectQuestion(question)}
            className={`
              text-xs px-3 py-1.5 rounded-full
              ${colors.bgLight} ${colors.text}
              border ${colors.border}
              ${colors.hover}
              transition-colors
            `}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
