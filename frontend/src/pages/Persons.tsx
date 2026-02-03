import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header, PageContent } from '../components/layout';
import { ListPanel } from '../components/common';
import {
  getPersons,
  getPersonTypes,
  createPersonType,
  deletePersonType,
} from '../api';
import { useEntityModalContext } from '../context/EntityModalContext';
import type { Person, PersonTypeRecord } from '../types';
import {
  Search,
  Filter,
  Phone,
  Mail,
  Building2,
  User,
  Settings,
  X,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';

// Helper to get primary contact info
function getPrimaryPhone(person: Person): string | null {
  const primary = person.phones?.find((p) => p.primary);
  return primary?.value || person.phones?.[0]?.value || null;
}

function getPrimaryEmail(person: Person): string | null {
  const primary = person.emails?.find((e) => e.primary);
  return primary?.value || person.emails?.[0]?.value || null;
}

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

// Manage Types Modal
function ManageTypesModal({
  isOpen,
  onClose,
  personTypes,
  typeCounts,
}: {
  isOpen: boolean;
  onClose: () => void;
  personTypes: PersonTypeRecord[];
  typeCounts: Record<string, number>;
}) {
  const queryClient = useQueryClient();
  const [newTypeName, setNewTypeName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (name: string) => createPersonType(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-types'] });
      setNewTypeName('');
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePersonType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-types'] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTypeName.trim()) {
      createMutation.mutate(newTypeName.trim().toLowerCase());
    }
  };

  const handleDelete = (pt: PersonTypeRecord) => {
    const count = typeCounts[pt.name] || 0;
    if (count > 0) {
      setError(`Cannot delete "${pt.name}": ${count} person(s) use this type`);
      return;
    }
    deleteMutation.mutate(pt.id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-bg-surface rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text">
            Manage Person Types
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-3 p-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Add new type */}
          <form onSubmit={handleCreate} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="New type name..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-bg-surface text-text placeholder-text-muted text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <button
              type="submit"
              disabled={createMutation.isPending || !newTypeName.trim()}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium inline-flex items-center gap-1"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </form>

          {/* Types list */}
          <div className="space-y-1">
            {personTypes.map((pt) => {
              const count = typeCounts[pt.name] || 0;

              return (
                <div
                  key={pt.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-hover group"
                >
                  <span className="flex-1 text-sm text-text capitalize">
                    {pt.name}
                  </span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {count} {count === 1 ? 'person' : 'persons'}
                  </span>
                  <button
                    onClick={() => handleDelete(pt)}
                    disabled={deleteMutation.isPending || count > 0}
                    className={`p-1 transition-opacity ${
                      count > 0
                        ? 'text-text-muted cursor-not-allowed'
                        : 'text-text-muted hover:text-red-600 opacity-0 group-hover:opacity-100'
                    }`}
                    title={count > 0 ? `Cannot delete: ${count} person(s) use this type` : 'Delete type'}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-text-secondary bg-bg-hover rounded-lg hover:bg-bg-elevated transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function Persons() {
  const { openModal } = useEntityModalContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [showManageTypes, setShowManageTypes] = useState(false);

  const { data: personsData, isLoading } = useQuery({
    queryKey: ['persons', { type: typeFilter || undefined, archived: showArchived || undefined }],
    queryFn: () => getPersons({ type: typeFilter || undefined, archived: showArchived || undefined }),
  });

  // Fetch all persons (without type filter) to get accurate counts
  const { data: allPersonsData } = useQuery({
    queryKey: ['persons', { archived: true }],
    queryFn: () => getPersons({ archived: true, limit: 10000 }),
  });

  const { data: personTypesData } = useQuery({
    queryKey: ['person-types'],
    queryFn: getPersonTypes,
  });

  // Calculate type counts from all persons
  const allPersons = allPersonsData?.persons;
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (allPersons) {
      for (const p of allPersons) {
        counts[p.person_type] = (counts[p.person_type] || 0) + 1;
      }
    }
    return counts;
  }, [allPersons]);

  // Filter persons by search query
  const persons = personsData?.persons;
  const filteredPersons = useMemo(() => {
    if (!persons) return [];
    if (!searchQuery) return persons;

    const query = searchQuery.toLowerCase();
    return persons.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.organization && p.organization.toLowerCase().includes(query)) ||
        p.emails?.some((e) => e.value.toLowerCase().includes(query)) ||
        p.phones?.some((ph) => ph.value.includes(query))
    );
  }, [persons, searchQuery]);

  return (
    <>
      <Header
        title="Persons"
        subtitle="Clients, attorneys, judges, experts, and other contacts"
      />

      <PageContent>
        {/* Search and Filters */}
        <ListPanel className="mb-6">
          <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-bg-surface text-text placeholder-text-muted text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Type Filter */}
            <Filter className="w-4 h-4 text-text-muted" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-secondary">Type:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border text-sm bg-bg-surface text-text"
              >
                <option value="">All</option>
                {personTypesData?.person_types?.map((pt) => (
                  <option key={pt.id} value={pt.name}>
                    {pt.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowManageTypes(true)}
                className="p-1.5 text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded transition-colors"
                title="Manage person types"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Archived Toggle */}
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-border text-primary-600 focus:ring-primary-500"
              />
              Show archived
            </label>
          </div>
        </ListPanel>

        {/* Persons List */}
        {isLoading ? (
          <ListPanel>
            <ListPanel.Loading />
          </ListPanel>
        ) : filteredPersons.length === 0 ? (
          <ListPanel>
            <ListPanel.Empty message="No persons found" />
          </ListPanel>
        ) : (
          <ListPanel>
            <ListPanel.Body>
              {filteredPersons.map((person) => {
                const phone = getPrimaryPhone(person);
                const email = getPrimaryEmail(person);

                return (
                  <ListPanel.Row
                    key={person.id}
                    onClick={() => openModal({ type: 'person', id: person.id })}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Avatar placeholder */}
                      <div className="w-9 h-9 rounded-full bg-bg-hover flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-text-muted" />
                      </div>

                      {/* Name and org */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text truncate">
                            {person.name}
                          </span>
                          {person.archived && (
                            <span className="text-xs text-text-muted">
                              (archived)
                            </span>
                          )}
                        </div>
                        {person.organization && (
                          <div className="flex items-center gap-1 text-xs text-text-secondary truncate">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            {person.organization}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="flex items-center gap-4 text-sm text-text-secondary">
                      {phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{phone}</span>
                        </span>
                      )}
                      {email && (
                        <span className="flex items-center gap-1.5 max-w-[180px] truncate">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="hidden md:inline truncate">{email}</span>
                        </span>
                      )}
                    </div>

                    {/* Type badge */}
                    <PersonTypeBadge type={person.person_type} />
                  </ListPanel.Row>
                );
              })}
            </ListPanel.Body>
          </ListPanel>
        )}

        {/* Results count */}
        {!isLoading && filteredPersons.length > 0 && (
          <div className="mt-3 text-sm text-text-secondary">
            Showing {filteredPersons.length} of {personsData?.total || 0} persons
          </div>
        )}
      </PageContent>

      {/* Manage Types Modal */}
      <ManageTypesModal
        isOpen={showManageTypes}
        onClose={() => setShowManageTypes(false)}
        personTypes={personTypesData?.person_types || []}
        typeCounts={typeCounts}
      />
    </>
  );
}
