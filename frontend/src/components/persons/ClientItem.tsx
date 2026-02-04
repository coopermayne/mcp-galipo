/**
 * ClientItem - Single client row in the clients feed
 *
 * Like PersonItem but tailored for clients:
 * - No type badge (they're all clients)
 * - Shows CaseChip(s) for each case assignment
 */
import { User, Phone, Mail, Building2 } from 'lucide-react';
import { useEntityModalContext } from '../../context/EntityModalContext';
import { CaseChip } from '../common/CaseChip';
import type { Person } from '../../types';

interface CaseAssignment {
  case_id: number;
  short_name: string;
  case_name: string;
  color: string;
}

function getPrimaryPhone(person: Person): string | null {
  const primary = person.phones?.find((p) => p.primary);
  return primary?.value || person.phones?.[0]?.value || null;
}

function getPrimaryEmail(person: Person): string | null {
  const primary = person.emails?.find((e) => e.primary);
  return primary?.value || person.emails?.[0]?.value || null;
}

interface ClientItemProps {
  person: Person & { case_assignments?: CaseAssignment[] };
  onClick?: (person: Person) => void;
}

export function ClientItem({ person, onClick }: ClientItemProps) {
  const { openModal } = useEntityModalContext();
  const phone = getPrimaryPhone(person);
  const email = getPrimaryEmail(person);
  const cases = person.case_assignments || [];

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

      {/* Case chip(s) */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {cases.slice(0, 2).map((ca) => (
          <CaseChip
            key={ca.case_id}
            caseId={ca.case_id}
            caseName={ca.case_name}
            shortName={ca.short_name}
            color={ca.color}
          />
        ))}
        {cases.length > 2 && (
          <span className="text-xs text-text-muted">+{cases.length - 2}</span>
        )}
        {cases.length === 0 && (
          <span className="text-xs text-text-muted italic">No cases</span>
        )}
      </div>
    </div>
  );
}
