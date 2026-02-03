import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Phone, Mail, MapPin, Star } from 'lucide-react';
import { useState } from 'react';
import type { CasePerson } from '../../types';

// Helper functions for extracting primary contact info
function getPrimaryPhone(phones: Array<{ value: string; primary?: boolean }> | undefined): string | undefined {
  if (!phones || phones.length === 0) return undefined;
  const primary = phones.find(p => p.primary);
  return (primary || phones[0])?.value;
}

function getPrimaryEmail(emails: Array<{ value: string; primary?: boolean }> | undefined): string | undefined {
  if (!emails || emails.length === 0) return undefined;
  const primary = emails.find(e => e.primary);
  return (primary || emails[0])?.value;
}

interface DraggablePersonChipProps {
  person: CasePerson;
  onOpenDetail: () => void;
  showStar?: boolean;
  variant?: 'default' | 'primary' | 'muted' | 'danger' | 'success' | 'warning';
  isNested?: boolean;
  isLastChild?: boolean;
  canBeDropTarget?: boolean;
  isDragDisabled?: boolean;
  hasChildren?: boolean;
}

export function DraggablePersonChip({
  person,
  onOpenDetail,
  showStar = false,
  variant = 'default',
  isNested = false,
  isLastChild = true,
  canBeDropTarget = true,
  isDragDisabled = false,
  hasChildren = false,
}: DraggablePersonChipProps) {
  const [copiedField, setCopiedField] = useState<'phone' | 'email' | 'address' | null>(null);

  // Parents with children can't be nested under others (only one level of nesting)
  const canBeDragged = !isDragDisabled && !hasChildren;

  // Draggable setup
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `person-${person.id}-${person.role}`,
    data: { person, hasChildren },
    disabled: !canBeDragged,
  });

  // Droppable setup (only if can be drop target)
  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: `drop-person-${person.id}-${person.role}`,
    data: { person },
    disabled: !canBeDropTarget || isDragging,
  });

  // Combine refs
  const setRefs = (node: HTMLDivElement | null) => {
    setDragRef(node);
    if (canBeDropTarget) {
      setDropRef(node);
    }
  };

  const phone = getPrimaryPhone(person.phones);
  const email = getPrimaryEmail(person.emails);

  // Build letter-ready address (multiline: name, org, address)
  const letterAddress = [
    person.name,
    person.organization,
    person.address,
  ].filter(Boolean).join('\n');
  const hasAddress = !!person.address;

  const copyToClipboard = async (text: string, field: 'phone' | 'email' | 'address') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleIconClick = (e: React.MouseEvent, text: string, field: 'phone' | 'email' | 'address') => {
    e.stopPropagation();
    copyToClipboard(text, field);
  };

  const variantClasses: Record<string, string> = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200',
    muted: 'bg-bg-hover text-text-secondary',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    default: 'bg-bg-hover text-text',
  };
  const baseClass = variantClasses[variant] || variantClasses.default;

  const copiedLabels = { phone: 'Phone copied!', email: 'Email copied!', address: 'Address copied!' };

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
  } : undefined;

  return (
    <div className={`relative flex items-center ${isNested ? 'ml-4' : ''}`}>
      {/* Tree connector for nested items */}
      {isNested && (
        <span className="text-text-muted font-mono text-xs mr-1 select-none">
          {isLastChild ? '└─' : '├─'}
        </span>
      )}
      <div
        ref={setRefs}
        style={style}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm cursor-pointer
          hover:opacity-80 transition-all
          ${baseClass}
          ${isDragging ? 'opacity-50 shadow-lg' : ''}
          ${isOver ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
        `}
        onClick={onOpenDetail}
      >
        {/* Drag handle - hidden if has children (can't nest parents) */}
        {canBeDragged && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3 text-text-muted" />
          </span>
        )}

        {showStar && person.is_primary && (
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        )}
        <span className="font-medium">
          {person.name}
        </span>
        {person.role && !['Client', 'Defendant'].includes(person.role) && (
          <span className="text-xs opacity-70">({person.role})</span>
        )}
        {/* Contact icons - copy to clipboard on click */}
        {(phone || email || hasAddress) && (
          <span className="flex items-center gap-0.5 ml-1">
            {phone && (
              <Phone
                className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={(e) => handleIconClick(e, phone, 'phone')}
              />
            )}
            {email && (
              <Mail
                className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={(e) => handleIconClick(e, email, 'email')}
              />
            )}
            {hasAddress && (
              <MapPin
                className="w-3 h-3 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={(e) => handleIconClick(e, letterAddress, 'address')}
              />
            )}
          </span>
        )}
      </div>
      {/* Copy confirmation tooltip */}
      {copiedField && (
        <div className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-bg-surface text-white text-xs rounded shadow-lg whitespace-nowrap">
          {copiedLabels[copiedField]}
        </div>
      )}
    </div>
  );
}

// Drop zone for un-nesting (dropping to root)
interface UnnestDropZoneProps {
  isVisible: boolean;
  sectionId: string;
}

export function UnnestDropZone({ isVisible, sectionId }: UnnestDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `unnest-${sectionId}`,
    data: { type: 'unnest', sectionId },
  });

  if (!isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      className={`
        mt-2 p-2 border-2 border-dashed rounded-md text-xs text-center transition-colors
        ${isOver
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
          : 'border-border text-text-muted'}
      `}
    >
      Drop here to un-nest
    </div>
  );
}
