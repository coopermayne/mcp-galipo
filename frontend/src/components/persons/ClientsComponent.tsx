/**
 * ClientsComponent - Self-contained clients list component
 *
 * Fetches clients (role category='client') with case assignments.
 * Renders alphabetically with client-side search filtering.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ClientItem } from './ClientItem';
import { getPersons } from '../../api';
import type { Person } from '../../types';

interface ClientsComponentProps {
  searchQuery?: string;
  userId?: number;
  onClientClick?: (person: Person) => void;
}

export function ClientsComponent({
  searchQuery = '',
  userId,
  onClientClick,
}: ClientsComponentProps) {
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['persons', { category: 'client', include_roles: true, user_id: userId }],
    queryFn: () =>
      getPersons({
        category: 'client',
        include_roles: true,
        user_id: userId,
        limit: 10000,
      }),
  });

  const clients = useMemo(() => {
    const allClients = clientsData?.persons || [];

    if (!searchQuery.trim()) return allClients;

    const query = searchQuery.toLowerCase();
    return allClients.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.organization && p.organization.toLowerCase().includes(query)) ||
        p.emails?.some((e) => e.value.toLowerCase().includes(query)) ||
        p.phones?.some((ph) => ph.value.includes(query))
    );
  }, [clientsData?.persons, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="py-8">
        <div className="text-center text-text-secondary py-8">
          {searchQuery ? 'No clients match your search' : 'No clients'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {clients.map((client) => (
        <ClientItem
          key={client.id}
          person={client}
          onClick={onClientClick}
        />
      ))}
    </div>
  );
}
