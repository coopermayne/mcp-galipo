import { TasksComponent } from '../../../components/tasks';

interface TasksTabProps {
  caseId: number;
}

export function TasksTab({ caseId }: TasksTabProps) {
  return (
    <div className="bg-bg-surface rounded-lg border border-border p-3">
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
