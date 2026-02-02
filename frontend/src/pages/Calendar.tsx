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
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
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
