import { TasksComponent } from '../../../components/tasks';

interface TasksTabProps {
  caseId: number;
}

export function TasksTab({ caseId }: TasksTabProps) {
  return (
    <TasksComponent
      caseId={caseId}
      showControls
      showDetailSheet
      enableInlineCreate
      defaultGroupBy="date"
      showCase={false}
    />
  );
}
