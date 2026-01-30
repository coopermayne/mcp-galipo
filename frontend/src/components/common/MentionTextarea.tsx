import { useState, useRef, useCallback, useEffect } from 'react';
import { MentionDropdown } from './MentionDropdown';
import { useEntityModalContext } from '../../context/EntityModalContext';
import type { CasePerson } from '../../types';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  persons: CasePerson[];
  caseId: number;
  placeholder?: string;
  className?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
}

// Regex to match mention markdown: [@Name](person:123)
const MENTION_REGEX = /\[@([^\]]+)\]\(person:(\d+)\)/g;

// Convert markdown to HTML with styled mention chips
function markdownToHtml(markdown: string): string {
  // Escape HTML entities first
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Replace mention markdown with styled spans
  html = html.replace(MENTION_REGEX, (_, name, id) => {
    return `<span class="mention-chip" data-person-id="${id}" contenteditable="false">@${name}</span>`;
  });

  // Convert newlines to <br> for display
  html = html.replace(/\n/g, '<br>');

  return html;
}

// Convert HTML back to markdown
function htmlToMarkdown(html: string): string {
  // Create a temporary container to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Walk through and convert
  let result = '';

  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (el.tagName === 'BR') {
        result += '\n';
      } else if (el.classList.contains('mention-chip')) {
        const personId = el.getAttribute('data-person-id');
        const name = (el.textContent || '').replace(/^@/, '');
        result += `[@${name}](person:${personId})`;
      } else if (el.tagName === 'DIV') {
        // Divs from contenteditable often represent line breaks
        if (result.length > 0 && !result.endsWith('\n')) {
          result += '\n';
        }
        el.childNodes.forEach(processNode);
      } else {
        el.childNodes.forEach(processNode);
      }
    }
  }

  temp.childNodes.forEach(processNode);

  return result;
}

export function MentionTextarea({
  value,
  onChange,
  persons,
  caseId,
  placeholder,
  className,
}: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0 });
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);
  const { openModal } = useEntityModalContext();

  // Get filtered persons for keyboard navigation
  const filteredPersons = persons.filter((person) =>
    person.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Update editor content when value changes externally (e.g., form reset)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Only update if value changed externally (not from our own edits)
    if (value !== lastValueRef.current) {
      const html = markdownToHtml(value);
      if (editor.innerHTML !== html) {
        editor.innerHTML = html || '';
      }
      lastValueRef.current = value;
    }
  }, [value]);

  // Initialize editor content on mount
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && value) {
      editor.innerHTML = markdownToHtml(value);
    }
  }, []);

  // Get cursor position relative to editor
  const getCursorPosition = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return { top: 0, left: 0 };

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { top: 0, left: 0 };

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();

    return {
      top: rect.bottom - editorRect.top + editor.scrollTop,
      left: Math.min(rect.left - editorRect.left, editorRect.width - 220),
    };
  }, []);

  // Get text content before cursor
  const getTextBeforeCursor = useCallback((): string => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';

    const range = selection.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editorRef.current!);
    preRange.setEnd(range.startContainer, range.startOffset);

    // Get text content, handling mention chips
    const temp = document.createElement('div');
    temp.appendChild(preRange.cloneContents());

    let text = '';
    function extractText(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList.contains('mention-chip')) {
          const personId = el.getAttribute('data-person-id');
          const name = (el.textContent || '').replace(/^@/, '');
          text += `[@${name}](person:${personId})`;
        } else if (el.tagName === 'BR') {
          text += '\n';
        } else {
          el.childNodes.forEach(extractText);
        }
      }
    }
    temp.childNodes.forEach(extractText);

    return text;
  }, []);

  // Handle input changes
  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const markdown = htmlToMarkdown(editor.innerHTML);
    lastValueRef.current = markdown;
    onChange(markdown);

    // Check for @ pattern
    const textBeforeCursor = getTextBeforeCursor();
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setSearchText(atMatch[1]);
      setHighlightedIndex(0);
      setShowDropdown(true);
      requestAnimationFrame(() => {
        setDropdownPosition(getCursorPosition());
      });
    } else {
      setShowDropdown(false);
    }
  }, [onChange, getTextBeforeCursor, getCursorPosition]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
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
          if (filteredPersons[highlightedIndex]) {
            e.preventDefault();
            handleSelectPerson(filteredPersons[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
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

  // Insert a person mention at cursor
  const handleSelectPerson = useCallback(
    (person: CasePerson) => {
      const editor = editorRef.current;
      if (!editor) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      // Find and delete the @search text
      const range = selection.getRangeAt(0);
      const textBeforeCursor = getTextBeforeCursor();
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        // Move back to delete the @ and search text
        const deleteLength = atMatch[0].length;

        // Create a range to delete the @mention text
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;

        if (startContainer.nodeType === Node.TEXT_NODE) {
          const textNode = startContainer as Text;
          const deleteStart = Math.max(0, startOffset - deleteLength);
          textNode.deleteData(deleteStart, deleteLength);

          // Insert the mention chip
          const chip = document.createElement('span');
          chip.className = 'mention-chip';
          chip.setAttribute('data-person-id', String(person.id));
          chip.setAttribute('contenteditable', 'false');
          chip.textContent = `@${person.name}`;

          // Insert chip and a space after it
          const newRange = document.createRange();
          newRange.setStart(textNode, deleteStart);
          newRange.collapse(true);

          newRange.insertNode(chip);

          // Add a space after the chip and move cursor there
          const space = document.createTextNode('\u00A0'); // non-breaking space
          chip.after(space);

          // Move cursor after the space
          const cursorRange = document.createRange();
          cursorRange.setStartAfter(space);
          cursorRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(cursorRange);
        }
      }

      // Update the value
      const markdown = htmlToMarkdown(editor.innerHTML);
      lastValueRef.current = markdown;
      onChange(markdown);

      setShowDropdown(false);
      editor.focus();
    },
    [getTextBeforeCursor, onChange]
  );

  // Handle paste - convert to plain text
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Handle clicks on mention chips to open person modal
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('mention-chip')) {
        e.preventDefault();
        const personId = target.getAttribute('data-person-id');
        if (personId) {
          openModal({
            type: 'person',
            id: parseInt(personId, 10),
            context: { caseId },
          });
        }
      }
    },
    [openModal, caseId]
  );

  const showPlaceholder = !isFocused && !value;

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={handleClick}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={className}
        style={{ minHeight: '80px' }}
        suppressContentEditableWarning
      />

      {/* Placeholder */}
      {showPlaceholder && (
        <div
          className="absolute top-0 left-0 pointer-events-none text-slate-400 px-3 py-2 text-sm"
          aria-hidden="true"
        >
          {placeholder}
        </div>
      )}

      {showDropdown && (
        <MentionDropdown
          persons={persons}
          searchText={searchText}
          position={dropdownPosition}
          highlightedIndex={highlightedIndex}
          onSelect={handleSelectPerson}
          onClose={() => setShowDropdown(false)}
          onHighlightChange={setHighlightedIndex}
        />
      )}

      {/* Styles for mention chips */}
      <style>{`
        .mention-chip {
          display: inline-flex;
          align-items: center;
          background-color: rgb(219 234 254); /* blue-100 */
          color: rgb(29 78 216); /* blue-700 */
          padding: 0 6px;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 500;
          margin: 0 1px;
          user-select: all;
          cursor: pointer;
        }
        .mention-chip:hover {
          background-color: rgb(191 219 254); /* blue-200 */
        }
        .dark .mention-chip {
          background-color: rgb(30 58 138 / 0.4); /* blue-900/40 */
          color: rgb(147 197 253); /* blue-300 */
        }
        .dark .mention-chip:hover {
          background-color: rgb(30 58 138 / 0.6); /* blue-900/60 */
        }
      `}</style>
    </div>
  );
}
