import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { JudgeAutocomplete } from './JudgeAutocomplete';
import type { Judge } from '../../types';

const JUDGE_ROLE_OPTIONS = ['Judge', 'Presiding', 'Magistrate', 'Panel', 'Other'];

interface AddJudgeDropdownProps {
  onAssign: (judge: Judge, role: string) => void;
  onCreateNew: (name: string, role: string) => void;
  excludeJudgeIds?: number[];
  /** Compact mode shows smaller button inline */
  compact?: boolean;
  /** Label to show next to the plus icon (only when compact) */
  label?: string;
}

export function AddJudgeDropdown({
  onAssign,
  onCreateNew,
  excludeJudgeIds = [],
  compact = false,
  label,
}: AddJudgeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen && !selectedRole) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, selectedRole]);

  // Close modal on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedRole) {
          setSelectedRole(null);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, selectedRole]);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedRole(null);
  };

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
  };

  const handleAssign = (judge: Judge) => {
    if (selectedRole) {
      onAssign(judge, selectedRole);
      handleClose();
    }
  };

  const handleCreate = (name: string) => {
    if (selectedRole) {
      onCreateNew(name, selectedRole);
      handleClose();
    }
  };

  return (
    <>
      {/* Plus button */}
      <div className={`relative ${compact ? 'inline-flex' : ''}`}>
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={`text-xs text-primary-600 hover:text-primary-700 ${isOpen ? 'invisible' : ''} ${compact && label ? 'inline-flex items-center gap-0.5' : ''}`}
        >
          <Plus className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          {compact && label && <span>{label}</span>}
        </button>

        {/* Dropdown menu - positioned so X overlaps the + button */}
        {isOpen && !selectedRole && (
          <div
            ref={dropdownRef}
            className="absolute right-[-6px] top-[-6px] z-20 bg-bg-surface rounded-lg shadow-lg border border-border py-1 min-w-[140px]"
          >
            <div className="flex items-center justify-between px-2 py-1 border-b border-border">
              <span className="text-xs font-medium text-text-muted">Add as...</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-0.5 text-text-muted hover:text-text rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {JUDGE_ROLE_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => handleRoleSelect(opt)}
                className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-bg-hover"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal for adding judge */}
      {selectedRole && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative w-full max-w-md transform rounded-xl bg-bg-surface shadow-xl transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text">
                  Add {selectedRole}
                </h3>
                <button
                  onClick={handleClose}
                  className="p-1 text-text-muted hover:text-text rounded-lg hover:bg-bg-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-sm text-text-muted mb-3">
                  Search for an existing judge or create a new one.
                </p>
                <JudgeAutocomplete
                  excludeJudgeIds={excludeJudgeIds}
                  onSelectJudge={handleAssign}
                  onCreateNew={handleCreate}
                  onCancel={handleClose}
                  placeholder="Search judges..."
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
