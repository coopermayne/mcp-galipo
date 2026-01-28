import type { Toast as ToastType } from '../../types';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
  onUndo?: () => void;
}

export function Toast({ toast, onDismiss, onUndo }: ToastProps) {
  return (
    <div className="flex items-center gap-3 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg min-w-[280px] max-w-[400px]">
      <span className="flex-1 text-sm">{toast.message}</span>
      {toast.undoAction && onUndo && (
        <button
          onClick={onUndo}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium shrink-0"
        >
          Undo
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-300 shrink-0"
        aria-label="Dismiss"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
