import { Calendar } from 'lucide-react';

interface DocketButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function DocketButton({ onClick, isOpen }: DocketButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        fixed z-40
        bottom-20 right-4 md:bottom-24 md:right-6
        w-14 h-14 md:w-14 md:h-14 rounded-full
        bg-amber-600 hover:bg-amber-700 active:bg-amber-800
        text-white shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2
        dark:focus:ring-offset-slate-900
        touch-manipulation
        ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
      `}
      aria-label="Open daily docket"
    >
      <Calendar className="w-6 h-6" />
    </button>
  );
}
