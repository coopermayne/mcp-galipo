/**
 * AssigneePicker - Dropdown for selecting task assignee
 *
 * Shows list of eligible users with initials and name.
 * Includes unassign option when someone is currently assigned.
 */
import { useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, UserMinus, User } from 'lucide-react';
import { getUserColorClass } from '../../utils';
import type { CaseStaffUser } from '../../types';

interface AssigneePickerProps {
  /** Currently assigned user ID (null = unassigned) */
  currentAssigneeId: number | null;
  /** List of users eligible for assignment */
  eligibleAssignees: CaseStaffUser[];
  /** Called when user selects a new assignee */
  onChange: (assigneeId: number | null) => void;
  /** Picker is open */
  isOpen: boolean;
  /** Close the picker */
  onClose: () => void;
  /** Anchor element for positioning */
  anchorEl: HTMLElement | null;
}

export function AssigneePicker({
  currentAssigneeId,
  eligibleAssignees,
  onChange,
  isOpen,
  onClose,
  anchorEl,
}: AssigneePickerProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Compute position from anchor element
  const position = useMemo(() => {
    if (!anchorEl || !isOpen) {
      return { top: 0, left: 0 };
    }
    const rect = anchorEl.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.left,
    };
  }, [anchorEl, isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (assigneeId: number | null) => {
    onChange(assigneeId);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={onClose}>
      <div
        ref={dropdownRef}
        className="absolute bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px] animate-fadeSlideIn"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
          Assign to
        </div>

        <div className="max-h-[240px] overflow-y-auto">
          {eligibleAssignees.map((user) => {
            const isSelected = currentAssigneeId === user.id;
            const colorClass = getUserColorClass(user.id);
            const fullName = `${user.first_name} ${user.last_name}`;

            return (
              <button
                key={user.id}
                onClick={() => handleSelect(user.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 ${
                  isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${colorClass}`}
                >
                  {user.initials}
                </span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                  {fullName}
                </span>
                {isSelected && (
                  <Check className="w-4 h-4 text-primary-500" />
                )}
              </button>
            );
          })}

          {eligibleAssignees.length === 0 && (
            <div className="px-4 py-6 text-center">
              <User className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No team members on this case</p>
            </div>
          )}
        </div>

        {/* Unassign option */}
        {currentAssigneeId !== null && (
          <div className="border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => handleSelect(null)}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <UserMinus className="w-4 h-4" />
              <span className="text-sm">Unassign</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.getElementById('datepicker-portal') || document.body
  );
}
