/**
 * TeamDropdown - Inline team assignment dropdown for case list items
 *
 * Shows attorneys and paralegals sections with add/remove functionality.
 * Uses StaffRef data (non-admin endpoint) rather than full User objects.
 */
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, ChevronDown, Loader2 } from 'lucide-react';
import {
  assignAttorneyToCase,
  removeAttorneyFromCase,
  assignParalegalToCase,
  removeParalegalFromCase,
} from '../../api';
import { getUserColorClass } from '../../utils';
import type { StaffRef } from '../../api/users';

interface TeamDropdownProps {
  caseId: number;
  attorneyIds: number[];
  paralegalIds: number[];
  staffMap: Map<number, StaffRef>;
  onClose: () => void;
}

function StaffAddButton({
  staff,
  selectedIds,
  onSelect,
  position,
}: {
  staff: StaffRef[];
  selectedIds: number[];
  onSelect: (id: number) => void;
  position: 'attorney' | 'paralegal';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filtered = staff.filter((s) => {
    if (selectedIds.includes(s.id)) return false;
    if (s.position !== position) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.initials.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-0.5 p-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
      >
        <Plus className="w-3.5 h-3.5" />
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 right-0 mt-1 w-52 bg-bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-bg-surface text-text placeholder-text-muted focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted italic">
                {search ? 'No matches' : 'None available'}
              </div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelect(s.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-bg-hover flex items-center gap-2"
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ${getUserColorClass(s.id)}`}>
                    {s.initials}
                  </span>
                  <span className="text-text-secondary truncate">
                    {s.firstName} {s.lastName}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamDropdown({
  caseId,
  attorneyIds,
  paralegalIds,
  staffMap,
  onClose,
}: TeamDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const allStaff = Array.from(staffMap.values());

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    // Use setTimeout so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cases'] });
    queryClient.invalidateQueries({ queryKey: ['case', caseId] });
  };

  const assignAttorneyMutation = useMutation({
    mutationFn: (userId: number) => assignAttorneyToCase(caseId, userId),
    onSuccess: invalidate,
  });

  const removeAttorneyMutation = useMutation({
    mutationFn: (userId: number) => removeAttorneyFromCase(caseId, userId),
    onSuccess: invalidate,
  });

  const assignParalegalMutation = useMutation({
    mutationFn: (userId: number) => assignParalegalToCase(caseId, userId),
    onSuccess: invalidate,
  });

  const removeParalegalMutation = useMutation({
    mutationFn: (userId: number) => removeParalegalFromCase(caseId, userId),
    onSuccess: invalidate,
  });

  const isPending = assignAttorneyMutation.isPending || removeAttorneyMutation.isPending ||
    assignParalegalMutation.isPending || removeParalegalMutation.isPending;

  const attorneyStaff = attorneyIds.map((id) => staffMap.get(id)).filter(Boolean) as StaffRef[];
  const paralegalStaff = paralegalIds.map((id) => staffMap.get(id)).filter(Boolean) as StaffRef[];

  return (
    <div
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-full mt-1 w-72 bg-bg-surface border border-border rounded-xl shadow-xl z-50"
    >
      {isPending && (
        <div className="absolute inset-0 bg-bg-surface/50 flex items-center justify-center z-10">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      )}

      {/* Attorneys section */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Attorneys</span>
          <StaffAddButton
            staff={allStaff}
            selectedIds={attorneyIds}
            onSelect={(id) => assignAttorneyMutation.mutate(id)}
            position="attorney"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {attorneyStaff.map((s) => (
            <div
              key={s.id}
              className="group/chip inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full bg-bg-hover/70 hover:bg-bg-hover transition-colors"
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold ${getUserColorClass(s.id)}`}>
                {s.initials}
              </span>
              <span className="text-xs text-text-secondary font-medium">{s.firstName}</span>
              <button
                onClick={() => removeAttorneyMutation.mutate(s.id)}
                className="p-0.5 rounded-full opacity-0 group-hover/chip:opacity-100 hover:bg-bg-surface transition-all"
              >
                <X className="w-3 h-3 text-text-muted" />
              </button>
            </div>
          ))}
          {attorneyStaff.length === 0 && (
            <span className="text-xs text-text-muted/60 italic">None assigned</span>
          )}
        </div>
      </div>

      {/* Paralegals section */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Paralegals</span>
          <StaffAddButton
            staff={allStaff}
            selectedIds={paralegalIds}
            onSelect={(id) => assignParalegalMutation.mutate(id)}
            position="paralegal"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {paralegalStaff.map((s) => (
            <div
              key={s.id}
              className="group/chip inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-full bg-bg-hover/70 hover:bg-bg-hover transition-colors"
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold ${getUserColorClass(s.id)}`}>
                {s.initials}
              </span>
              <span className="text-xs text-text-secondary font-medium">{s.firstName}</span>
              <button
                onClick={() => removeParalegalMutation.mutate(s.id)}
                className="p-0.5 rounded-full opacity-0 group-hover/chip:opacity-100 hover:bg-bg-surface transition-all"
              >
                <X className="w-3 h-3 text-text-muted" />
              </button>
            </div>
          ))}
          {paralegalStaff.length === 0 && (
            <span className="text-xs text-text-muted/60 italic">None assigned</span>
          )}
        </div>
      </div>
    </div>
  );
}
