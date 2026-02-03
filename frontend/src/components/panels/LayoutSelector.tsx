/**
 * LayoutSelector - Dropdown to select multi-panel layout preset
 *
 * Shows visual icons for each layout option:
 * - 1: Single panel
 * - 1:1: Two equal columns
 * - 1:2: Left panel + two stacked right panels
 * - 2:1: Two stacked left panels + right panel
 * - 2:2: Four equal quadrants
 */
import { useState } from 'react';
import { LayoutGrid, Check, ChevronDown, RotateCcw } from 'lucide-react';
import type { LayoutPreset } from '../../types/panel-layout';

interface LayoutOption {
  value: LayoutPreset;
  label: string;
  icon: React.ReactNode;
}

function LayoutIcon({ type }: { type: LayoutPreset }) {
  const baseClass = 'w-4 h-4 grid gap-0.5';

  switch (type) {
    case '1':
      return (
        <div className={`${baseClass} grid-cols-1`}>
          <div className="bg-current rounded-sm" />
        </div>
      );
    case '1:1':
      return (
        <div className={`${baseClass} grid-cols-2`}>
          <div className="bg-current rounded-sm" />
          <div className="bg-current rounded-sm" />
        </div>
      );
    case '1:2':
      return (
        <div className={`${baseClass} grid-cols-2 grid-rows-2`}>
          <div className="bg-current rounded-sm row-span-2" />
          <div className="bg-current rounded-sm" />
          <div className="bg-current rounded-sm" />
        </div>
      );
    case '2:1':
      return (
        <div className={`${baseClass} grid-cols-2 grid-rows-2`}>
          <div className="bg-current rounded-sm" />
          <div className="bg-current rounded-sm row-span-2" />
          <div className="bg-current rounded-sm" />
        </div>
      );
    case '2:2':
      return (
        <div className={`${baseClass} grid-cols-2 grid-rows-2`}>
          <div className="bg-current rounded-sm" />
          <div className="bg-current rounded-sm" />
          <div className="bg-current rounded-sm" />
          <div className="bg-current rounded-sm" />
        </div>
      );
  }
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  { value: '1', label: 'Single', icon: <LayoutIcon type="1" /> },
  { value: '1:1', label: 'Two columns', icon: <LayoutIcon type="1:1" /> },
  { value: '1:2', label: 'Left + 2 right', icon: <LayoutIcon type="1:2" /> },
  { value: '2:1', label: '2 left + Right', icon: <LayoutIcon type="2:1" /> },
  { value: '2:2', label: 'Four panels', icon: <LayoutIcon type="2:2" /> },
];

interface LayoutSelectorProps {
  value: LayoutPreset;
  onChange: (layout: LayoutPreset) => void;
  onReset?: () => void;
}

export function LayoutSelector({ value, onChange, onReset }: LayoutSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = LAYOUT_OPTIONS.find((opt) => opt.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
          isOpen
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
            : 'border-border bg-bg-surface text-text-secondary hover:bg-bg-hover'
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
        <span className="hidden sm:inline">{currentOption?.label || 'Layout'}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-48 py-2 bg-bg-surface border border-border rounded-lg shadow-lg z-50">
            <div className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
              Layout
            </div>
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-text hover:bg-bg-hover"
              >
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
                {value === option.value && (
                  <Check className="w-4 h-4 text-primary-500" />
                )}
              </button>
            ))}
            {onReset && (
              <>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => {
                    onReset();
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-muted hover:bg-bg-hover hover:text-text"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to defaults
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
