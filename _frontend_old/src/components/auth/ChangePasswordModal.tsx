import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChangePasswordForm } from './ChangePasswordForm';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { changePassword } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    const success = await changePassword(currentPassword, newPassword);
    if (success) {
      onClose();
    }
    return success;
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">
            Change Password
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4">
          <ChangePasswordForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            isFirstLogin={false}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
