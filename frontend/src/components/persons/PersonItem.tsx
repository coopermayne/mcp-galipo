/**
 * PersonItem - Single person row in the persons feed
 */
import { User, Phone, Mail, Building2 } from 'lucide-react';
import { useEntityModalContext } from '../../context/EntityModalContext';
import type { Person } from '../../types';

// Badge colors for different person types
const typeColors: Record<string, string> = {
  client: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  attorney: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  judge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  expert: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  mediator: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  witness: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  defendant: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  interpreter: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

function PersonTypeBadge({ type }: { type: string }) {
  const colorClasses =
    typeColors[type.toLowerCase()] ||
    'bg-bg-hover text-text-secondary';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${colorClasses}`}
    >
      {type}
    </span>
  );
}

function getPrimaryPhone(person: Person): string | null {
  const primary = person.phones?.find((p) => p.primary);
  return primary?.value || person.phones?.[0]?.value || null;
}

function getPrimaryEmail(person: Person): string | null {
  const primary = person.emails?.find((e) => e.primary);
  return primary?.value || person.emails?.[0]?.value || null;
}

interface PersonItemProps {
  person: Person;
  onClick?: (person: Person) => void;
}

export function PersonItem({ person, onClick }: PersonItemProps) {
  const { openModal } = useEntityModalContext();
  const phone = getPrimaryPhone(person);
  const email = getPrimaryEmail(person);

  const handleClick = () => {
    if (onClick) {
      onClick(person);
    } else {
      openModal({ type: 'person', id: person.id });
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover cursor-pointer border-b border-border last:border-b-0 transition-colors"
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-bg-hover flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-text-muted" />
      </div>

      {/* Name and org */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text text-sm truncate">
            {person.name}
          </span>
          {person.archived && (
            <span className="text-xs text-text-muted">(archived)</span>
          )}
        </div>
        {person.organization && (
          <div className="flex items-center gap-1 text-xs text-text-secondary truncate">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            {person.organization}
          </div>
        )}
      </div>

      {/* Contact info - hidden on small screens */}
      <div className="hidden sm:flex items-center gap-3 text-xs text-text-secondary">
        {phone && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            <span className="hidden md:inline">{phone}</span>
          </span>
        )}
        {email && (
          <span className="flex items-center gap-1 max-w-[140px] truncate">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="hidden lg:inline truncate">{email}</span>
          </span>
        )}
      </div>

      {/* Type badge */}
      <PersonTypeBadge type={person.person_type} />
    </div>
  );
}
