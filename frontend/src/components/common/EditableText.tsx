import { useState, useRef, useEffect, useCallback } from 'react';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useAutoSave } from '../../hooks/useAutoSave';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => Promise<unknown>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  maxLength?: number;
  disabled?: boolean;
}

export function EditableText({
  value,
  onSave,
  placeholder = 'Click to edit',
  className = '',
  inputClassName = '',
  multiline = false,
  maxLength,
  disabled = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const { save, cancel, status } = useAutoSave({
    onSave: async (newValue: string) => {
      await onSave(newValue);
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    if (!disabled) {
      setIsEditing(true);
      setEditValue(value);
    }
  }, [disabled, value]);

  const handleConfirm = useCallback(() => {
    if (editValue !== value) {
      save(editValue);
    }
    setIsEditing(false);
  }, [editValue, value, save]);

  const handleCancel = useCallback(() => {
    cancel();
    setEditValue(value);
    setIsEditing(false);
  }, [cancel, value]);

  const { handleKeyDown } = useKeyboard({
    onEnter: multiline ? undefined : handleConfirm,
    onEscape: handleCancel,
    enabled: isEditing,
  });

  const handleBlur = useCallback(() => {
    handleConfirm();
  }, [handleConfirm]);

  const statusIcon = () => {
    switch (status) {
      case 'saving':
        return <Loader2 className="w-3 h-3 animate-spin text-slate-400" />;
      case 'saved':
        return <Check className="w-3 h-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input';
    return (
      <div className={`relative inline-flex items-center gap-1 ${className}`}>
        <InputComponent
          ref={inputRef as any}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown as any}
          onBlur={handleBlur}
          maxLength={maxLength}
          className={`
            px-2 py-1 rounded border border-primary-500 bg-slate-700 text-slate-100
            focus:border-primary-400 focus:ring-1 focus:ring-primary-500
            text-sm outline-none
            ${multiline ? 'resize-none min-h-[60px]' : ''}
            ${inputClassName}
          `}
          rows={multiline ? 3 : undefined}
        />
        {statusIcon()}
      </div>
    );
  }

  return (
    <div className={`group relative inline-flex items-center gap-1 ${className}`}>
      <span
        onClick={handleStartEdit}
        className={`
          px-2 py-1 rounded cursor-pointer text-slate-100
          hover:bg-slate-700 transition-colors
          ${!value ? 'text-slate-500 italic' : ''}
          ${disabled ? 'cursor-default hover:bg-transparent' : ''}
        `}
      >
        {value || placeholder}
      </span>
      {statusIcon()}
    </div>
  );
}
