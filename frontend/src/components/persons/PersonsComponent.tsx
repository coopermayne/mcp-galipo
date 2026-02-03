/**
 * PersonsComponent - Self-contained persons list component
 *
 * Fetches and manages person data. Handles:
 * - Data fetching
 * - Filtering by type, archived status, and search
 * - Grouping by type, alpha, or recent
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PersonsFeed } from './PersonsFeed';
import { getPersons } from '../../api';
import type { Person } from '../../types';

type GroupMode = 'type' | 'alpha' | 'recent';

interface PersonsComponentProps {
  /** How to group persons */
  groupBy?: GroupMode;
  /** Callback when group by changes */
  onGroupByChange?: (groupBy: GroupMode) => void;
  /** Show archived persons */
  showArchived?: boolean;
  /** Callback when showArchived changes */
  onShowArchivedChange?: (showArchived: boolean) => void;
  /** Filter by person type */
  typeFilter?: string;
  /** Search query */
  searchQuery?: string;
  /** Callback when a person is clicked */
  onPersonClick?: (person: Person) => void;
}

export function PersonsComponent({
  groupBy = 'type',
  showArchived = false,
  typeFilter,
  searchQuery = '',
  onPersonClick,
}: PersonsComponentProps) {
  // Fetch persons
  const { data: personsData, isLoading } = useQuery({
    queryKey: ['persons', { type: typeFilter, archived: showArchived || undefined }],
    queryFn: () => getPersons({ type: typeFilter || undefined, archived: showArchived || undefined }),
  });

  // Filter persons
  const persons = useMemo(() => {
    const allPersons = personsData?.persons || [];
    let filtered = allPersons;

    // Filter by archived status
    if (!showArchived) {
      filtered = filtered.filter((p) => !p.archived);
    }

    // Filter by type if specified
    if (typeFilter) {
      filtered = filtered.filter((p) => p.person_type === typeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.organization && p.organization.toLowerCase().includes(query)) ||
          p.emails?.some((e) => e.value.toLowerCase().includes(query)) ||
          p.phones?.some((ph) => ph.value.includes(query))
      );
    }

    return filtered;
  }, [personsData?.persons, showArchived, typeFilter, searchQuery]);

  return (
    <PersonsFeed
      persons={persons}
      isLoading={isLoading}
      groupBy={groupBy}
      emptyMessage={searchQuery ? 'No persons match your search' : 'No persons'}
      onClick={onPersonClick}
    />
  );
}
