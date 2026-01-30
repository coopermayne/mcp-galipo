import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PersonAutocomplete } from './PersonAutocomplete';
import type { Person, PersonType } from '../../types';

interface AddPersonDropdownProps {
  roleOptions: string[];
  onAssign: (person: Person, role: string) => void;
  onCreate: (name: string, role: string) => void;
  excludePersonIds?: number[];
  getPersonTypes?: (role: string) => PersonType[] | undefined;
  getPlaceholder?: (role: string) => string;
}

export function AddPersonDropdown({
  roleOptions,
  onAssign,
  onCreate,
  excludePersonIds = [],
  getPersonTypes,
  getPlaceholder,
}: AddPersonDropdownProps) {
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

  const handleAssign = (person: Person) => {
    if (selectedRole) {
      onAssign(person, selectedRole);
      handleClose();
    }
  };

  const handleCreate = (name: string) => {
    if (selectedRole) {
      onCreate(name, selectedRole);
      handleClose();
    }
  };

  const personTypes = selectedRole && getPersonTypes ? getPersonTypes(selectedRole) : undefined;
  const placeholder = selectedRole && getPlaceholder ? getPlaceholder(selectedRole) : 'Search or create new...';

  return (
    <>
      {/* Plus button */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={`text-xs text-primary-600 hover:text-primary-700 ${isOpen ? 'invisible' : ''}`}
        >
          <Plus className="w-3 h-3" />
        </button>

        {/* Dropdown menu - positioned so X overlaps the + button */}
        {isOpen && !selectedRole && (
          <div
            ref={dropdownRef}
            className="absolute right-[-6px] top-[-6px] z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 min-w-[140px]"
          >
            <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Add as...</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {roleOptions.map(opt => (
              <button
                key={opt}
                onClick={() => handleRoleSelect(opt)}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal for adding person */}
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
              className="relative w-full max-w-md transform rounded-xl bg-white dark:bg-slate-800 shadow-xl transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Add {selectedRole}
                </h3>
                <button
                  onClick={handleClose}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  Search for an existing person or create a new one.
                </p>
                <PersonAutocomplete
                  personTypes={personTypes}
                  excludePersonIds={excludePersonIds}
                  onSelectPerson={handleAssign}
                  onCreateNew={handleCreate}
                  onCancel={handleClose}
                  placeholder={placeholder}
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
