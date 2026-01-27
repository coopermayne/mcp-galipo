import { useState, useRef, useEffect } from 'react';
import { Star, Plus, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAutoSave } from '../../hooks/useAutoSave';

interface ContactEntry {
  value: string;
  label?: string;
  primary?: boolean;
}

interface EditableContactListProps {
  entries: ContactEntry[];
  onSave: (entries: ContactEntry[]) => Promise<unknown>;
  type: 'phone' | 'email';
  disabled?: boolean;
}

const PHONE_LABELS = ['Mobile', 'Work', 'Home', 'Fax'];
const EMAIL_LABELS = ['Work', 'Personal'];

export function EditableContactList({
  entries,
  onSave,
  type,
  disabled = false,
}: EditableContactListProps) {
  const [localEntries, setLocalEntries] = useState<ContactEntry[]>(entries);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const labels = type === 'phone' ? PHONE_LABELS : EMAIL_LABELS;
  const placeholder = type === 'phone' ? '(555) 123-4567' : 'email@example.com';
  const emptyText = type === 'phone' ? 'No phone numbers' : 'No email addresses';

  const { save, status } = useAutoSave({
    onSave: async (newEntries: ContactEntry[]) => {
      await onSave(newEntries);
    },
  });

  // Sync external changes
  useEffect(() => {
    if (editingIndex === null) {
      setLocalEntries(entries);
    }
  }, [entries, editingIndex]);

  // Focus input when editing
  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingIndex]);

  const handleStartEdit = (index: number) => {
    if (disabled) return;
    setEditingIndex(index);
    setEditValue(localEntries[index].value);
  };

  const handleConfirmEdit = () => {
    if (editingIndex === null) return;

    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      // If value is empty, remove the entry
      handleDelete(editingIndex);
      setEditingIndex(null);
      return;
    }

    const newEntries = [...localEntries];
    newEntries[editingIndex] = { ...newEntries[editingIndex], value: trimmedValue };
    setLocalEntries(newEntries);
    setEditingIndex(null);
    save(newEntries);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleSetPrimary = (index: number) => {
    if (disabled) return;
    const newEntries = localEntries.map((entry, i) => ({
      ...entry,
      primary: i === index,
    }));
    setLocalEntries(newEntries);
    save(newEntries);
  };

  const handleLabelChange = (index: number, label: string) => {
    if (disabled) return;
    const newEntries = [...localEntries];
    newEntries[index] = { ...newEntries[index], label: label || undefined };
    setLocalEntries(newEntries);
    save(newEntries);
  };

  const handleDelete = (index: number) => {
    if (disabled) return;
    const newEntries = localEntries.filter((_, i) => i !== index);
    // If we deleted the primary, make the first one primary
    if (localEntries[index].primary && newEntries.length > 0) {
      newEntries[0].primary = true;
    }
    setLocalEntries(newEntries);
    save(newEntries);
  };

  const handleAdd = () => {
    if (disabled) return;
    const newEntry: ContactEntry = {
      value: '',
      label: labels[0],
      primary: localEntries.length === 0,
    };
    const newEntries = [...localEntries, newEntry];
    setLocalEntries(newEntries);
    setEditingIndex(newEntries.length - 1);
    setEditValue('');
  };

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

  return (
    <div className="space-y-2">
      {localEntries.length === 0 && editingIndex === null && (
        <span className="text-slate-400 italic text-sm">{emptyText}</span>
      )}

      {localEntries.map((entry, index) => (
        <div
          key={index}
          className="flex items-center gap-2 group"
        >
          {/* Primary star */}
          <button
            type="button"
            onClick={() => handleSetPrimary(index)}
            disabled={disabled}
            className={`p-0.5 rounded transition-colors ${
              entry.primary
                ? 'text-amber-500'
                : 'text-slate-300 dark:text-slate-600 hover:text-amber-400 dark:hover:text-amber-500'
            } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
            title={entry.primary ? 'Primary' : 'Set as primary'}
          >
            <Star className={`w-4 h-4 ${entry.primary ? 'fill-current' : ''}`} />
          </button>

          {/* Value */}
          {editingIndex === index ? (
            <input
              ref={inputRef}
              type={type === 'email' ? 'email' : 'tel'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleConfirmEdit}
              placeholder={placeholder}
              className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-primary-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          ) : (
            <span
              onClick={() => handleStartEdit(index)}
              className={`flex-1 min-w-0 px-2 py-1 text-sm rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300 ${
                disabled ? 'cursor-default hover:bg-transparent' : ''
              }`}
            >
              {entry.value || <span className="text-slate-400 italic">{placeholder}</span>}
            </span>
          )}

          {/* Label dropdown */}
          <select
            value={entry.label || ''}
            onChange={(e) => handleLabelChange(index, e.target.value)}
            disabled={disabled}
            className="text-xs px-1.5 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
          >
            <option value="">No label</option>
            {labels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>

          {/* Delete button */}
          {!disabled && (
            <button
              type="button"
              onClick={() => handleDelete(index)}
              className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}

      {/* Add button and status */}
      <div className="flex items-center gap-2">
        {!disabled && (
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add {type}
          </button>
        )}
        {statusIcon()}
      </div>
    </div>
  );
}
