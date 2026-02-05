/**
 * PersonsComponent - Self-contained persons list component
 *
 * Fetches and manages person data. Handles:
 * - Data fetching
 * - Filtering by category and search
 * - Grouping by category, alpha, or recent
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PersonsFeed } from './PersonsFeed';
import { getPersons } from '../../api';
import type { Person, RoleCategory } from '../../types';

type GroupMode = 'category' | 'alpha' | 'recent';

interface PersonsComponentProps {
  /** How to group persons */
  groupBy?: GroupMode;
  /** Callback when group by changes */
  onGroupByChange?: (groupBy: GroupMode) => void;
  /** Filter by role category */
  categoryFilter?: RoleCategory;
  /** Filter by role_id */
  roleFilter?: number;
  /** Search query */
  searchQuery?: string;
  /** Show only persons not assigned to any case */
  showUnassigned?: boolean;
  /** Callback when a person is clicked */
  onPersonClick?: (person: Person) => void;
}

export function PersonsComponent({
  groupBy = 'category',
  categoryFilter,
  roleFilter,
  searchQuery = '',
  showUnassigned = false,
  onPersonClick,
}: PersonsComponentProps) {
  // Fetch persons with role data
  const { data: personsData, isLoading } = useQuery({
    queryKey: ['persons', { category: categoryFilter, role_id: roleFilter, unassigned: showUnassigned || undefined }],
    queryFn: () => getPersons({
      category: categoryFilter || undefined,
      role_id: roleFilter || undefined,
      unassigned: showUnassigned || undefined,
      include_roles: true,
      limit: 10000,
    }),
  });

  // Filter persons
  const persons = useMemo(() => {
    const allPersons = personsData?.persons || [];
    let filtered = allPersons;

    // Filter by category if specified (and not already filtered at API level)
    if (categoryFilter && !roleFilter) {
      filtered = filtered.filter((p) =>
        p.roles?.some((r) => r.role.category === categoryFilter)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.organization && p.organization.toLowerCase().includes(query)) ||
          p.emails?.some((e) => e.value?.toLowerCase().includes(query)) ||
          p.phones?.some((ph) => ph.value?.includes(query))
      );
    }

    return filtered;
  }, [personsData?.persons, categoryFilter, roleFilter, searchQuery]);

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
