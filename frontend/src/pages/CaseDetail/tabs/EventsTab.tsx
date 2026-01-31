import { EventsComponent } from '../../../components/events';

interface EventsTabProps {
  caseId: number;
}

export function EventsTab({ caseId }: EventsTabProps) {
  return (
    <EventsComponent
      caseId={caseId}
      showControls
      groupByDate
      showCase={false}
      pastDays={365}
    />
  );
}
