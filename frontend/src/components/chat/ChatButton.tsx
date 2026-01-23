import { MessageCircle } from 'lucide-react';

interface ChatButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function ChatButton({ onClick, isOpen }: ChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        fixed z-40
        bottom-4 right-4 md:bottom-6 md:right-6
        w-14 h-14 md:w-14 md:h-14 rounded-full
        bg-blue-600 hover:bg-blue-700 active:bg-blue-800
        text-white shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        dark:focus:ring-offset-slate-900
        touch-manipulation
        ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
      `}
      aria-label="Open chat"
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
}
