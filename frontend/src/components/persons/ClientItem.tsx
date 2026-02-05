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
import type { Person, PersonRole } from '../../types';

function getPrimaryPhone(person: Person): string | null {
  const primary = person.phones?.find((p) => p.primary);
  return primary?.value || person.phones?.[0]?.value || null;
}

function getPrimaryEmail(person: Person): string | null {
  const primary = person.emails?.find((e) => e.primary);
  return primary?.value || person.emails?.[0]?.value || null;
}

interface ClientItemProps {
  person: Person;
  onClick?: (person: Person) => void;
}

export function ClientItem({ person, onClick }: ClientItemProps) {
  const { openModal } = useEntityModalContext();
  const phone = getPrimaryPhone(person);
  const email = getPrimaryEmail(person);
  // Get case roles (roles with case_id)
  const caseRoles = (person.roles || []).filter((r: PersonRole) => r.case_id);

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
        {caseRoles.slice(0, 2).map((r: PersonRole) => (
          <CaseChip
            key={r.case_id}
            caseId={r.case_id!}
            caseName={r.case_name}
            shortName={r.short_name}
            color={r.color}
          />
        ))}
        {caseRoles.length > 2 && (
          <span className="text-xs text-text-muted">+{caseRoles.length - 2}</span>
        )}
        {caseRoles.length === 0 && (
          <span className="text-xs text-text-muted italic">No cases</span>
        )}
      </div>
    </div>
  );
}
