import { useState, useRef, useCallback, useEffect } from 'react';
import { MentionDropdown } from './MentionDropdown';
import type { CasePerson } from '../../types';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  persons: CasePerson[];
  placeholder?: string;
  className?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
}

export function MentionTextarea({
  value,
  onChange,
  persons,
  placeholder,
  className,
}: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0 });
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  // Get filtered persons count for keyboard navigation bounds
  const filteredPersons = persons.filter((person) =>
    person.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Calculate cursor position using a mirror element
  const calculateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return { top: 0, left: 0 };

    // Copy textarea styles to mirror
    const computed = getComputedStyle(textarea);
    mirror.style.width = computed.width;
    mirror.style.padding = computed.padding;
    mirror.style.fontSize = computed.fontSize;
    mirror.style.fontFamily = computed.fontFamily;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';

    // Get text up to cursor and add a span marker
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);

    // Create mirror content with marker span
    mirror.innerHTML = '';
    const textNode = document.createTextNode(textBeforeCursor);
    const marker = document.createElement('span');
    marker.id = 'cursor-marker';
    mirror.appendChild(textNode);
    mirror.appendChild(marker);

    // Get marker position relative to textarea
    const markerRect = marker.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();

    return {
      top: markerRect.top - textareaRect.top + textarea.scrollTop + 20, // 20px below cursor
      left: Math.min(markerRect.left - textareaRect.left, textareaRect.width - 220), // Keep dropdown in view
    };
  }, [value]);

  // Detect @ mentions while typing
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;
      onChange(newValue);

      // Check for @ pattern before cursor
      const textBeforeCursor = newValue.substring(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        setMentionStartIndex(cursorPos - atMatch[0].length);
        setSearchText(atMatch[1]);
        setHighlightedIndex(0);
        setShowDropdown(true);

        // Calculate position after state update
        requestAnimationFrame(() => {
          setDropdownPosition(calculateCursorPosition());
        });
      } else {
        setShowDropdown(false);
        setMentionStartIndex(null);
      }
    },
    [onChange, calculateCursorPosition]
  );

  // Handle keyboard navigation in dropdown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showDropdown) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, filteredPersons.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredPersons[highlightedIndex]) {
            handleSelectPerson(filteredPersons[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          setMentionStartIndex(null);
          break;
        case 'Tab':
          if (filteredPersons[highlightedIndex]) {
            e.preventDefault();
            handleSelectPerson(filteredPersons[highlightedIndex]);
          }
          break;
      }
    },
    [showDropdown, highlightedIndex, filteredPersons]
  );

  // Handle person selection from dropdown
  const handleSelectPerson = useCallback(
    (person: CasePerson) => {
      if (mentionStartIndex === null) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const beforeMention = value.substring(0, mentionStartIndex);
      const afterCursor = value.substring(cursorPos);

      // Insert markdown link format: [@Name](person:id)
      const mentionLink = `[@${person.name}](person:${person.id})`;
      const newValue = beforeMention + mentionLink + ' ' + afterCursor;

      onChange(newValue);
      setShowDropdown(false);
      setMentionStartIndex(null);

      // Set cursor position after the inserted mention
      requestAnimationFrame(() => {
        const newCursorPos = mentionStartIndex + mentionLink.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      });
    },
    [mentionStartIndex, value, onChange]
  );

  // Close dropdown when cursor moves away from @ mention
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !showDropdown) return;

    const handleSelectionChange = () => {
      if (mentionStartIndex === null) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (!atMatch) {
        setShowDropdown(false);
        setMentionStartIndex(null);
      }
    };

    // Use a small delay to allow the selection to update
    const handleClick = () => setTimeout(handleSelectionChange, 0);
    textarea.addEventListener('click', handleClick);

    return () => textarea.removeEventListener('click', handleClick);
  }, [showDropdown, mentionStartIndex, value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />

      {/* Hidden mirror element for cursor position calculation */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="absolute top-0 left-0 pointer-events-none invisible overflow-hidden"
        style={{ position: 'absolute', visibility: 'hidden' }}
      />

      {showDropdown && (
        <MentionDropdown
          persons={persons}
          searchText={searchText}
          position={dropdownPosition}
          highlightedIndex={highlightedIndex}
          onSelect={handleSelectPerson}
          onClose={() => {
            setShowDropdown(false);
            setMentionStartIndex(null);
          }}
          onHighlightChange={setHighlightedIndex}
        />
      )}
    </div>
  );
}
