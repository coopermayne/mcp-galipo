import { Header, PageContent } from '../components/layout';
import { EventsComponent } from '../components/events';

export function Calendar() {
  return (
    <>
      <Header
        title="Calendar"
        subtitle="Hearings, depositions, and important dates"
      />

      <PageContent>
        <div className="bg-bg-surface rounded-lg border border-border p-3">
          <EventsComponent
            showAllEvents
            groupByDate
            pastDays={365}
          />
        </div>
      </PageContent>
    </>
  );
}
