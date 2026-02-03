import { EventsComponent } from '../../../components/events';

interface EventsTabProps {
  caseId: number;
}

export function EventsTab({ caseId }: EventsTabProps) {
  return (
    <div className="bg-bg-surface rounded-lg border border-border p-3">
      <EventsComponent
        caseId={caseId}
        groupByDate
        showCase={false}
        pastDays={365}
      />
    </div>
  );
}
