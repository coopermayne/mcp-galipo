# DatePicker Improvement Plan

## Problem Statement

The current react-day-picker implementation makes it difficult to:
1. Navigate to dates far in the future/past (must click through each month)
2. Type dates directly
3. Quickly jump to a specific month or year

## Solution: Switch to react-datepicker

[react-datepicker](https://reactdatepicker.com/) by HackerOne provides built-in solutions for all these issues.

---

## Installation

```bash
npm install react-datepicker
npm uninstall react-day-picker  # remove old package
```

---

## Key Props to Use

| Prop | Value | Purpose |
|------|-------|---------|
| `selected` | `Date \| null` | Currently selected date |
| `onChange` | `(date: Date \| null) => void` | Callback when date changes |
| `showYearDropdown` | `true` | Enable year dropdown |
| `showMonthDropdown` | `true` | Enable month dropdown |
| `scrollableYearDropdown` | `true` | Make year dropdown scrollable |
| `yearDropdownItemNumber` | `20` | Show 20 years in dropdown |
| `dateFormat` | `"M/d/yyyy"` | Format for the input field |
| `isClearable` | `true` | Show clear button |
| `placeholderText` | `"Select date"` | Placeholder when no date |
| `disabled` | `boolean` | Disable the picker |
| `popperPlacement` | `"bottom-start"` | Dropdown positioning |
| `showPopperArrow` | `false` | Hide the arrow pointer |

---

## Implementation Steps

### Step 1: Update Imports

```tsx
// Remove
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/src/style.css';

// Add
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
```

### Step 2: Update EditableDate Component

```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import { format, parse, isValid } from 'date-fns';
import { useAutoSave } from '../../hooks/useAutoSave';
import { formatSmartDate, type DateFormatOptions } from '../../utils/dateFormat';
import { Check, AlertCircle, Loader2, Calendar, X } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';

interface EditableDateProps extends DateFormatOptions {
  value: string | null;
  onSave: (value: string | null) => Promise<unknown>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function EditableDate({
  value,
  onSave,
  placeholder = 'Select date',
  className = '',
  disabled = false,
  clearable = true,
  showDayOfWeek = true,
  alwaysShowYear = false,
  numeric = false,
}: EditableDateProps) {
  const { save, status } = useAutoSave({
    onSave: async (newValue: string | null) => {
      await onSave(newValue);
    },
    debounceMs: 0,
  });

  // Parse string value to Date object
  const dateValue = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const isValidDate = dateValue && isValid(dateValue);

  const handleChange = useCallback(
    (date: Date | null) => {
      const newValue = date ? format(date, 'yyyy-MM-dd') : null;
      if (newValue !== value) {
        save(newValue);
      }
    },
    [value, save]
  );

  const statusIcon = () => {
    switch (status) {
      case 'saving':
        return <Loader2 className="w-3 h-3 animate-spin text-slate-400" />;
      case 'saved':
        return <Check className="w-3 h-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <DatePicker
        selected={isValidDate ? dateValue : null}
        onChange={handleChange}
        dateFormat="M/d/yyyy"
        placeholderText={placeholder}
        disabled={disabled}
        isClearable={clearable}
        showYearDropdown
        showMonthDropdown
        scrollableYearDropdown
        yearDropdownItemNumber={20}
        popperPlacement="bottom-start"
        showPopperArrow={false}
        className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600
                   bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                   focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                   disabled:opacity-60 disabled:cursor-not-allowed"
        calendarClassName="dark:bg-slate-700"
      />
      {statusIcon()}
    </div>
  );
}
```

### Step 3: Add Dark Mode CSS Overrides

Add to `src/index.css`:

```css
/* React DatePicker dark mode overrides */
.dark .react-datepicker {
  background-color: var(--theme-bg-elevated);
  border-color: var(--theme-border);
  color: var(--theme-text);
}

.dark .react-datepicker__header {
  background-color: var(--theme-bg-surface);
  border-color: var(--theme-border);
}

.dark .react-datepicker__current-month,
.dark .react-datepicker__day-name,
.dark .react-datepicker__day {
  color: var(--theme-text);
}

.dark .react-datepicker__day:hover {
  background-color: var(--theme-bg-hover);
}

.dark .react-datepicker__day--selected {
  background-color: var(--color-primary-500);
  color: white;
}

.dark .react-datepicker__day--keyboard-selected {
  background-color: var(--color-primary-600);
  color: white;
}

.dark .react-datepicker__day--today {
  font-weight: bold;
  color: var(--color-primary-400);
}

.dark .react-datepicker__month-dropdown,
.dark .react-datepicker__year-dropdown {
  background-color: var(--theme-bg-elevated);
  border-color: var(--theme-border);
}

.dark .react-datepicker__month-option,
.dark .react-datepicker__year-option {
  color: var(--theme-text);
}

.dark .react-datepicker__month-option:hover,
.dark .react-datepicker__year-option:hover {
  background-color: var(--theme-bg-hover);
}

.dark .react-datepicker__navigation-icon::before {
  border-color: var(--theme-text-secondary);
}

.dark .react-datepicker__year-read-view--down-arrow,
.dark .react-datepicker__month-read-view--down-arrow {
  border-color: var(--theme-text-secondary);
}

/* Input styling */
.react-datepicker-wrapper {
  display: inline-block;
}

.react-datepicker__input-container input {
  width: 100%;
}

/* Clear button styling */
.react-datepicker__close-icon::after {
  background-color: var(--theme-text-muted);
}

.dark .react-datepicker__close-icon::after {
  background-color: var(--theme-text-muted);
}
```

---

## Display Format Consideration

The react-datepicker input shows the date in a standard format (e.g., `1/22/2026`). Our smart date format (`Mo, Jan 22`) is used for display when the picker is closed.

**Options:**
1. **Simple**: Just use react-datepicker's format everywhere
2. **Custom**: Keep our smart format for display, use standard for input
   - This would require a custom input component using `customInput` prop

### Custom Input Example (if needed):

```tsx
const CustomInput = forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
  ({ value, onClick }, ref) => (
    <button
      type="button"
      onClick={onClick}
      ref={ref}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded
                 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
    >
      <Calendar className="w-3.5 h-3.5" />
      <span>{value || 'Select date'}</span>
    </button>
  )
);

// Usage:
<DatePicker
  customInput={<CustomInput />}
  // ... other props
/>
```

---

## Testing Checklist

- [ ] Basic date selection works
- [ ] Year dropdown works and shows correct range
- [ ] Month dropdown works
- [ ] Navigation arrows work
- [ ] Typing dates directly works
- [ ] Clear button works
- [ ] Disabled state works
- [ ] Dark mode styling looks correct
- [ ] Light mode styling looks correct
- [ ] Mobile/touch interaction works
- [ ] Date format displays correctly
- [ ] Auto-save triggers on change

---

## Potential Issues & Mitigations

### 1. Keyboard Accessibility in Dropdowns
**Issue**: [GitHub #4127](https://github.com/Hacker0x01/react-datepicker/issues/4127) - dropdowns not keyboard accessible
**Mitigation**: Mouse/touch users unaffected; typing dates still works for keyboard users

### 2. Bundle Size
**Issue**: react-datepicker adds ~50KB to bundle
**Mitigation**: Acceptable trade-off for better UX

### 3. TypeScript Types
**Issue**: May need `@types/react-datepicker`
**Solution**: `npm install @types/react-datepicker --save-dev`

---

## Rollback Plan

If issues arise, revert to the current react-day-picker implementation:
1. `npm uninstall react-datepicker`
2. `npm install react-day-picker`
3. Restore EditableDate.tsx from git history

---

## References

- [react-datepicker GitHub](https://github.com/Hacker0x01/react-datepicker)
- [react-datepicker Demo Site](https://reactdatepicker.com/)
- [Props Documentation](https://github.com/Hacker0x01/react-datepicker/blob/main/docs/datepicker.md)
