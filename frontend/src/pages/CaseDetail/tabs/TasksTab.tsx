import { TasksComponent } from '../../../components/tasks';

interface TasksTabProps {
  caseId: number;
}

export function TasksTab({ caseId }: TasksTabProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <TasksComponent
        caseId={caseId}
        showControls
        showDetailSheet
        enableInlineCreate
        defaultGroupBy="date"
        showCase={false}
      />
    </div>
  );
}
