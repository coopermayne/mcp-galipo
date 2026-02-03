import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import type { User, UserPosition } from '../../types';

interface UserSelectProps {
  users: User[];
  selectedIds: number[];
  onSelect: (userId: number) => void;
  filterPosition?: UserPosition;
  placeholder?: string;
  buttonSize?: 'sm' | 'md';
}

export function UserSelect({
  users,
  selectedIds,
  onSelect,
  filterPosition,
  placeholder = 'Add user...',
  buttonSize = 'sm',
}: UserSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
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

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter users
  const filteredUsers = users.filter(user => {
    // Exclude already selected
    if (selectedIds.includes(user.id)) return false;
    // Filter by position if specified
    if (filterPosition && user.position !== filterPosition) return false;
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      return fullName.includes(searchLower) || user.initials.toLowerCase().includes(searchLower);
    }
    return true;
  });

  const buttonClasses = buttonSize === 'sm'
    ? 'p-1 text-xs'
    : 'p-1.5 text-sm';

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-0.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 ${buttonClasses}`}
        title={placeholder}
      >
        <Plus className="w-3.5 h-3.5" />
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 right-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* User list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400 italic">
                {search ? 'No matching users' : 'No users available'}
              </div>
            ) : (
              filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => {
                    onSelect(user.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
                    {user.initials}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-700 dark:text-slate-300 truncate">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-xs text-slate-400 capitalize">{user.position}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
