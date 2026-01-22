import { Trash2, Phone, Mail } from 'lucide-react';
import { getPrimaryPhone, getPrimaryEmail } from '../utils';

interface ContactCardProps {
  contact: {
    assignment_id: number;
    id: number;
    name: string;
    role?: string;
    organization?: string;
    phones?: Array<{ value: string; label?: string; primary?: boolean }>;
    emails?: Array<{ value: string; label?: string; primary?: boolean }>;
  };
  onRemove: () => void;
  highlightSide?: boolean;
}

export function ContactCard({ contact, onRemove, highlightSide = false }: ContactCardProps) {
  // Determine side coloring for experts
  const isPlaintiffSide = contact.role?.includes('Plaintiff');
  const isDefendantSide = contact.role?.includes('Defendant');

  return (
    <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg group relative flex items-start gap-3">
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-3 h-3" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{contact.name}</p>
          {contact.role && (
            <span
              className={`
              inline-block px-2 py-0.5 rounded text-xs
              ${
                highlightSide && isPlaintiffSide
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  : highlightSide && isDefendantSide
                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                    : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              }
            `}
            >
              {contact.role}
            </span>
          )}
        </div>
        {contact.organization && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{contact.organization}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
          {getPrimaryPhone(contact.phones) && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {getPrimaryPhone(contact.phones)}
            </p>
          )}
          {getPrimaryEmail(contact.emails) && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {getPrimaryEmail(contact.emails)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
