/**
 * AttorneyFilterDropdown - Filter cases by assigned attorney
 *
 * Options:
 * - All (default)
 * - My Cases
 * - Unassigned
 * - Individual attorneys (multiselect via checkboxes)
 */
import { useState, useRef, useEffect } from 'react';
import { User, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserColorClass } from '../../utils';
import type { CaseAttorneyFilter } from '../../types/panel-layout';
import type { AttorneyRef } from '../../api/users';

interface AttorneyFilterDropdownProps {
  value: CaseAttorneyFilter;
  onChange: (value: CaseAttorneyFilter) => void;
  attorneys: AttorneyRef[];
}

export function AttorneyFilterDropdown({
  value,
  onChange,
  attorneys,
}: AttorneyFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleRadioSelect = (newValue: 'all' | 'mine' | 'unassigned') => {
    onChange(newValue);
    setIsOpen(false);
  };

  const handleAttorneyToggle = (attorneyId: number) => {
    const currentIds = Array.isArray(value) ? value : [];
    const newIds = currentIds.includes(attorneyId)
      ? currentIds.filter((id) => id !== attorneyId)
      : [...currentIds, attorneyId];

    if (newIds.length === 0) {
      onChange('all');
    } else {
      onChange(newIds);
    }
  };

  const getDisplayText = (): string => {
    if (value === 'all') return 'All';
    if (value === 'mine') return 'My Cases';
    if (value === 'unassigned') return 'Unassigned';
    if (Array.isArray(value)) {
      if (value.length === 1) {
        const attorney = attorneys.find((a) => a.id === value[0]);
        return attorney ? attorney.initials : 'All';
      }
      return `${value.length} attorneys`;
    }
    return 'All';
  };

  const hasNonDefault = value !== 'all';

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
          hasNonDefault
            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
            : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/50'
        }`}
      >
        <User className="w-3.5 h-3.5" />
        <span>{getDisplayText()}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-52 py-2 bg-bg-surface border border-border rounded-lg shadow-lg z-50 animate-fadeSlideIn">
          <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
            Show cases
          </div>

          {/* All */}
          <button
            onClick={() => handleRadioSelect('all')}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-text hover:bg-bg-hover"
          >
            <div className="w-4 h-4" />
            <span className="flex-1">All cases</span>
            {value === 'all' && <Check className="w-4 h-4 text-primary-500" />}
          </button>

          {/* My Cases */}
          <button
            onClick={() => handleRadioSelect('mine')}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-text hover:bg-bg-hover"
          >
            {currentUser && (
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-medium ${getUserColorClass(currentUser.id)}`}
              >
                {currentUser.initials}
              </span>
            )}
            <span className="flex-1">My Cases</span>
            {value === 'mine' && <Check className="w-4 h-4 text-primary-500" />}
          </button>

          {/* Unassigned */}
          <button
            onClick={() => handleRadioSelect('unassigned')}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-text hover:bg-bg-hover"
          >
            <User className="w-4 h-4 text-text-muted" />
            <span className="flex-1">Unassigned</span>
            {value === 'unassigned' && <Check className="w-4 h-4 text-primary-500" />}
          </button>

          {/* Attorney list with checkboxes */}
          {attorneys.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Attorneys
              </div>
              {attorneys.map((attorney) => {
                const isChecked = Array.isArray(value) && value.includes(attorney.id);
                return (
                  <button
                    key={attorney.id}
                    onClick={() => handleAttorneyToggle(attorney.id)}
                    className="flex items-center gap-3 w-full px-3 py-2 text-sm text-text hover:bg-bg-hover"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-medium ${getUserColorClass(attorney.id)}`}
                    >
                      {attorney.initials}
                    </span>
                    <span className="flex-1 text-left">
                      {attorney.firstName} {attorney.lastName}
                    </span>
                    {isChecked && <Check className="w-4 h-4 text-primary-500" />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
