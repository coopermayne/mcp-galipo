/**
 * Toast - Simple notification popup with optional undo action
 */
import { useEffect, useState, type ReactNode } from 'react';
import { X, Undo2 } from 'lucide-react';

export interface ToastData {
  id: string;
  message: ReactNode;
  onUndo?: () => void;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const handleUndo = () => {
    if (toast.onUndo) {
      toast.onUndo();
    }
    handleDismiss();
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl ring-1 ring-white/10
        transform transition-all duration-200
        ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
      `}
    >
      <span className="text-sm">{toast.message}</span>

      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-white/10 rounded transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
        </button>
      )}

      <button
        onClick={handleDismiss}
        className="p-1 text-gray-400 hover:text-white rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
