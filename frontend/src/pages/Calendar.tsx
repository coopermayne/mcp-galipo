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
        <div className="sm:max-w-2xl sm:bg-white sm:dark:bg-slate-800 sm:rounded-lg sm:border sm:border-slate-200 sm:dark:border-slate-700 sm:p-3">
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
