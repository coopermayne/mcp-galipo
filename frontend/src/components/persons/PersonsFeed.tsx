/**
 * PersonsFeed - List of persons with optional grouping
 */
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { PersonItem } from './PersonItem';
import type { Person } from '../../types';

type GroupMode = 'type' | 'alpha' | 'recent';

interface PersonGroup {
  key: string;
  label: string;
  persons: Person[];
}

interface PersonsFeedProps {
  persons: Person[];
  isLoading?: boolean;
  groupBy?: GroupMode;
  emptyMessage?: string;
  onClick?: (person: Person) => void;
}

/**
 * Group persons by type (client, attorney, judge, etc.)
 */
function groupPersonsByType(persons: Person[]): PersonGroup[] {
  const groups: Map<string, PersonGroup> = new Map();

  // Sort persons alphabetically within groups
  const sorted = [...persons].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  for (const person of sorted) {
    const key = person.person_type || 'other';
    const label = key.charAt(0).toUpperCase() + key.slice(1);

    if (!groups.has(key)) {
      groups.set(key, { key, label, persons: [] });
    }
    groups.get(key)!.persons.push(person);
  }

  // Sort groups by label
  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

/**
 * Group persons alphabetically by first letter
 */
function groupPersonsAlpha(persons: Person[]): PersonGroup[] {
  const groups: Map<string, PersonGroup> = new Map();

  const sorted = [...persons].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  for (const person of sorted) {
    const letter = person.name.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';

    if (!groups.has(key)) {
      groups.set(key, { key, label: key, persons: [] });
    }
    groups.get(key)!.persons.push(person);
  }

  return Array.from(groups.values());
}

/**
 * Group persons by recent activity (using updated_at)
 */
function groupPersonsRecent(persons: Person[]): PersonGroup[] {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const groups: Map<string, PersonGroup> = new Map([
    ['this_week', { key: 'this_week', label: 'This Week', persons: [] }],
    ['this_month', { key: 'this_month', label: 'This Month', persons: [] }],
    ['older', { key: 'older', label: 'Older', persons: [] }],
  ]);

  // Sort by updated_at descending
  const sorted = [...persons].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  for (const person of sorted) {
    const updatedAt = new Date(person.updated_at);

    if (updatedAt >= oneWeekAgo) {
      groups.get('this_week')!.persons.push(person);
    } else if (updatedAt >= oneMonthAgo) {
      groups.get('this_month')!.persons.push(person);
    } else {
      groups.get('older')!.persons.push(person);
    }
  }

  // Filter out empty groups
  return Array.from(groups.values()).filter((g) => g.persons.length > 0);
}

export function PersonsFeed({
  persons,
  isLoading = false,
  groupBy = 'type',
  emptyMessage = 'No persons',
  onClick,
}: PersonsFeedProps) {
  const groups = useMemo(() => {
    switch (groupBy) {
      case 'alpha':
        return groupPersonsAlpha(persons);
      case 'recent':
        return groupPersonsRecent(persons);
      case 'type':
      default:
        return groupPersonsByType(persons);
    }
  }, [persons, groupBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (persons.length === 0) {
    return (
      <div className="py-8">
        <div className="text-center text-text-secondary py-8">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.key} className="mb-4">
          {/* Section header */}
          {group.label && (
            <>
              <div className="flex items-center justify-between py-2 px-2">
                <h3 className="text-sm font-semibold text-text">
                  {group.label}
                  <span className="ml-2 text-text-muted font-normal">
                    ({group.persons.length})
                  </span>
                </h3>
              </div>
              <div className="border-b border-border mx-2" />
            </>
          )}

          {/* Person list */}
          {group.persons.map((person) => (
            <PersonItem
              key={person.id}
              person={person}
              onClick={onClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
