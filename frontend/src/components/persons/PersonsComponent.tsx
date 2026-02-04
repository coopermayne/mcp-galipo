/**
 * PersonsComponent - Self-contained persons list component
 *
 * Fetches and manages person data. Handles:
 * - Data fetching
 * - Filtering by type and search
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
  /** Filter by person type */
  typeFilter?: string;
  /** Search query */
  searchQuery?: string;
  /** Show only persons not assigned to any case */
  showUnassigned?: boolean;
  /** Callback when a person is clicked */
  onPersonClick?: (person: Person) => void;
}

export function PersonsComponent({
  groupBy = 'type',
  typeFilter,
  searchQuery = '',
  showUnassigned = false,
  onPersonClick,
}: PersonsComponentProps) {
  // Fetch persons
  const { data: personsData, isLoading } = useQuery({
    queryKey: ['persons', { type: typeFilter, unassigned: showUnassigned || undefined }],
    queryFn: () => getPersons({ type: typeFilter || undefined, unassigned: showUnassigned || undefined, limit: 10000 }),
  });

  // Filter persons
  const persons = useMemo(() => {
    const allPersons = personsData?.persons || [];
    let filtered = allPersons;

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
  }, [personsData?.persons, typeFilter, searchQuery]);

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
