import { useEffect, useRef } from 'react';
import { User } from 'lucide-react';
import type { CasePerson } from '../../types';

interface MentionDropdownProps {
  persons: CasePerson[];
  searchText: string;
  position: { top: number; left: number };
  highlightedIndex: number;
  onSelect: (person: CasePerson) => void;
  onClose: () => void;
  onHighlightChange: (index: number) => void;
}

export function MentionDropdown({
  persons,
  searchText,
  position,
  highlightedIndex,
  onSelect,
  onClose,
  onHighlightChange,
}: MentionDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter persons by search text
  const filteredPersons = persons.filter((person) =>
    person.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    const highlighted = dropdownRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  if (filteredPersons.length === 0) {
    return (
      <div
        ref={dropdownRef}
        style={{ top: position.top, left: position.left }}
        className="absolute z-50 bg-bg-surface border border-border rounded shadow-lg min-w-[200px] max-w-[300px]"
      >
        <div className="px-3 py-2 text-xs text-text-muted">
          {persons.length === 0 ? 'No people on this case' : 'No matches found'}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      style={{ top: position.top, left: position.left }}
      className="absolute z-50 bg-bg-surface border border-border rounded shadow-lg max-h-48 overflow-y-auto min-w-[200px] max-w-[300px]"
    >
      {filteredPersons.map((person, index) => (
        <button
          key={person.id}
          type="button"
          data-index={index}
          onClick={() => onSelect(person)}
          onMouseEnter={() => onHighlightChange(index)}
          className={`w-full px-3 py-2 text-left text-xs flex items-start gap-2 ${
            highlightedIndex === index
              ? 'bg-primary-50 dark:bg-primary-900/30'
              : 'hover:bg-bg-hover'
          }`}
        >
          <User className="w-3 h-3 mt-0.5 text-text-muted shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-text truncate">
              {person.name}
            </div>
            <div className="text-text-secondary truncate">
              {person.role?.name}
              {person.organization && ` · ${person.organization}`}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
