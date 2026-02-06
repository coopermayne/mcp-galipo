/**
 * JudgesComponent - Self-contained judges list component
 *
 * Fetches judges from the judges table.
 * Renders alphabetically with client-side search filtering.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { JudgeItem } from './JudgeItem';
import { getJudges } from '../../api';
import type { Judge } from '../../types';

interface JudgesComponentProps {
  searchQuery?: string;
  onJudgeClick?: (judge: Judge) => void;
}

export function JudgesComponent({
  searchQuery = '',
  onJudgeClick,
}: JudgesComponentProps) {
  const { data: judgesData, isLoading } = useQuery({
    queryKey: ['judges'],
    queryFn: () => getJudges({ limit: 10000 }),
  });

  const judges = useMemo(() => {
    const allJudges = judgesData?.judges || [];

    // Sort alphabetically by name
    const sorted = [...allJudges].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    if (!searchQuery.trim()) return sorted;

    const query = searchQuery.toLowerCase();
    return sorted.filter(
      (j) =>
        j.name.toLowerCase().includes(query) ||
        (j.jurisdiction_name && j.jurisdiction_name.toLowerCase().includes(query)) ||
        (j.chambers && j.chambers.toLowerCase().includes(query)) ||
        j.emails?.some((e) => e.value.toLowerCase().includes(query)) ||
        j.phones?.some((ph) => ph.value.includes(query))
    );
  }, [judgesData?.judges, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (judges.length === 0) {
    return (
      <div className="py-8">
        <div className="text-center text-text-secondary py-8">
          {searchQuery ? 'No judges match your search' : 'No judges'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {judges.map((judge) => (
        <JudgeItem
          key={judge.id}
          judge={judge}
          onClick={onJudgeClick}
        />
      ))}
    </div>
  );
}
