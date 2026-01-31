/**
 * Tasks - Todoist-style task list
 *
 * Route: /tasks
 *
 * Features:
 * - Date-based grouping (Overdue, Today, Tomorrow, etc.)
 * - Case-based grouping (alphabetical)
 * - Minimal task rows with hover actions
 * - Priority shown via checkbox color
 */
import { Header, PageContent } from '../components/layout';
import { TasksComponent } from '../components/tasks';

export function Tasks() {
  return (
    <>
      <Header title="Tasks" subtitle="Track your to-dos" />

      <PageContent>
        <div className="max-w-2xl">
          <TasksComponent
            showAllTasks
            showControls
            showDetailSheet
            enableInlineCreate
            defaultGroupBy="date"
          />
        </div>
      </PageContent>
    </>
  );
}
