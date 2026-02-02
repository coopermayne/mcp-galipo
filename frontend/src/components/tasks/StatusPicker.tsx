/**
 * StatusPicker - Popover for selecting task status
 *
 * Opens as a portal-rendered dropdown with the 4 main statuses.
 * Same UX on desktop and mobile (click to open, tap/click to select).
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { STATUS_CONFIG } from './statusConfig';
import { ActiveStatusIcon } from './ActiveStatusIcon';
import type { TaskStatus } from '../../types';

interface StatusPickerProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  currentStatus: TaskStatus;
  onSelect: (status: TaskStatus) => void;
  onClose: () => void;
}

export function StatusPicker({
  isOpen,
  anchorEl,
  currentStatus,
  onSelect,
  onClose,
}: StatusPickerProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  // Calculate position based on anchor element
  useEffect(() => {
    if (isOpen && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const popoverWidth = 160;
      const popoverHeight = 180;

      // Position below the anchor
      let top = rect.bottom + 4;
      let left = rect.left;

      // Adjust horizontal position if it would go off-screen
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }

      // Adjust vertical position if it would go off-screen
      if (top + popoverHeight > window.innerHeight - 16) {
        top = rect.top - popoverHeight - 4;
      }

      setPosition({ top, left });
    }
  }, [isOpen, anchorEl]);

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

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      // Delay to prevent immediate close from the same click that opened it
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const portalRoot = document.getElementById('datepicker-portal') || document.body;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-[9999]"
      style={{ top: position.top, left: position.left, minWidth: 160 }}
    >
      <div className="py-1">
        {STATUS_CONFIG.map((config) => {
          const Icon = config.icon;
          const isSelected = config.value === currentStatus;

          return (
            <button
              key={config.value}
              onClick={() => onSelect(config.value)}
              className={`
                flex items-center gap-3 w-full px-3 py-2 text-left text-sm
                hover:bg-slate-50 dark:hover:bg-slate-700
                ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
              `}
            >
              {config.value === 'Active' ? (
                <span className="text-slate-500 dark:text-slate-400">
                  <ActiveStatusIcon className="w-4 h-4" />
                </span>
              ) : (
                <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
              <span className="flex-1 text-slate-700 dark:text-slate-200">
                {config.label}
              </span>
              {isSelected && (
                <Check className="w-4 h-4 text-primary-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>,
    portalRoot
  );
}
