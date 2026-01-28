import { useUndo } from '../../context/UndoContext';
import { Toast } from './Toast';

export function ToastContainer() {
  const { toasts, dismissToast, undo } = useUndo();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onUndo={toast.undoAction ? undo : undefined}
        />
      ))}
    </div>
  );
}
