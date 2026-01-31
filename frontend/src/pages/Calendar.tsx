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
        <EventsComponent
          showAllEvents
          groupByDate
          pastDays={365}
        />
      </PageContent>
    </>
  );
}
