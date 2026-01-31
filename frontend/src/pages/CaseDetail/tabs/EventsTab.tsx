import { EventsComponent } from '../../../components/events';

interface EventsTabProps {
  caseId: number;
}

export function EventsTab({ caseId }: EventsTabProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <EventsComponent
        caseId={caseId}
        groupByDate
        showCase={false}
        pastDays={365}
      />
    </div>
  );
}
