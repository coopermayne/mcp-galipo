import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { Header, PageContent } from '../components/layout';
import {
  StatusBadge,
  UrgencyBadge,
  EditableText,
  EditableSelect,
  EditableDate,
  EditableTime,
  ListPanel,
  ConfirmModal,
} from '../components/common';
import { DraggableTaskRow } from '../components/tasks';
import { TaskDropZones } from '../components/docket';
import { useDragContext } from '../context/DragContext';
import { getStats, getTasks, getEvents, getConstants, updateTask, deleteTask, updateEvent, deleteEvent, updateDocket } from '../api';
import type { Task, Event } from '../types';
import {
  Briefcase,
  CheckSquare,
  Clock,
  ChevronRight,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';

// Deterministic color mapping for case badges
const caseColorClasses = [
  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
];

const getCaseColorClass = (caseId: number) => caseColorClasses[caseId % caseColorClasses.length];

export function Dashboard() {
  const queryClient = useQueryClient();
  const { startDrag, endDrag } = useDragContext();
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<number | null>(null);
  const [deleteEventTarget, setDeleteEventTarget] = useState<number | null>(null);
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['dashboard-tasks', { showDone: showDoneTasks }],
    queryFn: () => getTasks(showDoneTasks ? { status: 'Done', limit: 10 } : { exclude_status: 'Done', limit: 10 }),
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['dashboard-events', { showPast: showPastEvents }],
    queryFn: () => getEvents({
      limit: 10,
      includePast: showPastEvents,
      pastDays: 14,
    }),
  });

  const { data: constants } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) => updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) => updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const docketMutation = useMutation({
    mutationFn: ({ taskId, category }: { taskId: number; category: 'today' | 'tomorrow' | 'backburner' }) =>
      updateDocket(taskId, { docket_category: category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['docket'] });
    },
  });

  // Tasks are filtered based on toggle
  const displayTasks = tasksData?.tasks || [];

  // Events are already filtered by the API based on showPastEvents
  const displayEvents = eventsData?.events || [];

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = displayTasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
      startDrag(task, 'dashboard');
    }
  }, [displayTasks, startDrag]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    endDrag();

    if (!over) return;

    const task = displayTasks.find((t) => t.id === active.id);
    if (!task) return;

    const overId = over.id.toString();
    if (overId === 'drop-done') {
      updateTaskMutation.mutate({ id: task.id, data: { status: 'Done' } });
    } else if (overId === 'drop-today') {
      docketMutation.mutate({ taskId: task.id, category: 'today' });
    } else if (overId === 'drop-tomorrow') {
      docketMutation.mutate({ taskId: task.id, category: 'tomorrow' });
    } else if (overId === 'drop-backburner') {
      docketMutation.mutate({ taskId: task.id, category: 'backburner' });
    }
  }, [displayTasks, updateTaskMutation, docketMutation, endDrag]);

  const handleUpdateTask = useCallback(
    async (taskId: number, field: string, value: any) => {
      await updateTaskMutation.mutateAsync({ id: taskId, data: { [field]: value } });
    },
    [updateTaskMutation]
  );

  const handleDeleteTask = useCallback(
    (taskId: number) => {
      setDeleteTaskTarget(taskId);
    },
    []
  );

  const confirmDeleteTask = useCallback(() => {
    if (deleteTaskTarget) {
      deleteTaskMutation.mutate(deleteTaskTarget);
      setDeleteTaskTarget(null);
    }
  }, [deleteTaskTarget, deleteTaskMutation]);

  const handleUpdateEvent = useCallback(
    async (eventId: number, field: string, value: any) => {
      await updateEventMutation.mutateAsync({ id: eventId, data: { [field]: value } });
    },
    [updateEventMutation]
  );

  const handleDeleteEvent = useCallback(
    (eventId: number) => {
      setDeleteEventTarget(eventId);
    },
    []
  );

  const confirmDeleteEvent = useCallback(() => {
    if (deleteEventTarget) {
      deleteEventMutation.mutate(deleteEventTarget);
      setDeleteEventTarget(null);
    }
  }, [deleteEventTarget, deleteEventMutation]);

  const taskStatusOptions = (constants?.task_statuses || []).map((s) => ({
    value: s,
    label: s,
  }));

  const urgencyOptions = [
    { value: '1', label: '1 - Low' },
    { value: '2', label: '2 - Medium' },
    { value: '3', label: '3 - High' },
    { value: '4', label: '4 - Urgent' },
  ];

  return (
    <>
      <Header title="Overview" subtitle="Your cases at a glance" />

      <PageContent variant="full">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Cases"
            value={stats?.total_cases ?? '-'}
            icon={Briefcase}
            loading={statsLoading}
            href="/cases"
          />
          <StatCard
            title="Active Cases"
            value={stats?.active_cases ?? '-'}
            icon={Briefcase}
            loading={statsLoading}
            href="/cases"
            variant="primary"
          />
          <StatCard
            title="Pending Tasks"
            value={stats?.pending_tasks ?? '-'}
            icon={CheckSquare}
            loading={statsLoading}
            href="/tasks"
            variant="warning"
          />
          <StatCard
            title="Upcoming Events"
            value={stats?.upcoming_events ?? '-'}
            icon={Clock}
            loading={statsLoading}
            href="/calendar"
            variant="danger"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Tasks</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDoneTasks(!showDoneTasks)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    showDoneTasks
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {showDoneTasks ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  Done
                </button>
                <Link
                  to="/tasks"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <ListPanel>
                {tasksLoading ? (
                  <ListPanel.Loading />
                ) : displayTasks.length === 0 ? (
                  <ListPanel.Empty message={showDoneTasks ? "No completed tasks" : "No pending tasks"} />
                ) : (
                  <ListPanel.Body>
                    {displayTasks.slice(0, 8).map((task) => (
                      <DraggableTaskRow key={task.id} task={task} className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <Link
                          to={`/cases/${task.case_id}`}
                          className={`px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 w-20 truncate text-center ${getCaseColorClass(task.case_id)}`}
                          title={task.short_name || task.case_name || `Case #${task.case_id}`}
                        >
                          {task.short_name || task.case_name || `Case #${task.case_id}`}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <EditableText
                            value={task.description}
                            onSave={(value) => handleUpdateTask(task.id, 'description', value)}
                            className="text-sm"
                          />
                        </div>
                        <EditableDate
                          value={task.due_date || null}
                          onSave={(value) => handleUpdateTask(task.id, 'due_date', value)}
                          placeholder="Due"
                        />
                        <EditableSelect
                          value={task.status}
                          options={taskStatusOptions}
                          onSave={(value) => handleUpdateTask(task.id, 'status', value)}
                          renderValue={(value) => <StatusBadge status={value} />}
                        />
                        <EditableSelect
                          value={String(task.urgency)}
                          options={urgencyOptions}
                          onSave={(value) => handleUpdateTask(task.id, 'urgency', parseInt(value))}
                          renderValue={(value) => <UrgencyBadge urgency={parseInt(value)} />}
                        />
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </DraggableTaskRow>
                    ))}
                  </ListPanel.Body>
                )}
              </ListPanel>

              {/* Drop zones for docket */}
              <TaskDropZones isVisible={activeTask !== null} />

              {/* Drag overlay */}
              <DragOverlay dropAnimation={null}>
                {activeTask && (
                  <div className="px-4 py-3 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-primary-500 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCaseColorClass(activeTask.case_id)}`}>
                      {activeTask.short_name || activeTask.case_name}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {activeTask.description}
                    </span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Upcoming Events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Events</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPastEvents(!showPastEvents)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    showPastEvents
                      ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {showPastEvents ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {showPastEvents ? 'Past' : 'Upcoming'}
                </button>
                <Link
                  to="/calendar"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <ListPanel>
              {eventsLoading ? (
                <ListPanel.Loading />
              ) : displayEvents.length === 0 ? (
                <ListPanel.Empty message={showPastEvents ? "No past events" : "No upcoming events"} />
              ) : (
                <ListPanel.Body>
                  {displayEvents.slice(0, 8).map((event) => (
                    <ListPanel.Row key={event.id}>
                      <Link
                        to={`/cases/${event.case_id}`}
                        className={`px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 w-20 truncate text-center ${getCaseColorClass(event.case_id)}`}
                        title={event.short_name || event.case_name || `Case #${event.case_id}`}
                      >
                        {event.short_name || event.case_name || `Case #${event.case_id}`}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <EditableText
                          value={event.description}
                          onSave={(value) => handleUpdateEvent(event.id, 'description', value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-0">
                        <EditableDate
                          value={event.date}
                          onSave={(value) => handleUpdateEvent(event.id, 'date', value)}
                          clearable={false}
                        />
                        <EditableTime
                          value={event.time || null}
                          onSave={(value) => handleUpdateEvent(event.id, 'time', value)}
                        />
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </ListPanel.Row>
                  ))}
                </ListPanel.Body>
              )}
            </ListPanel>
          </div>
        </div>
      </PageContent>

      <ConfirmModal
        isOpen={!!deleteTaskTarget}
        onClose={() => setDeleteTaskTarget(null)}
        onConfirm={confirmDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        confirmText="Delete Task"
        variant="danger"
        isLoading={deleteTaskMutation.isPending}
      />

      <ConfirmModal
        isOpen={!!deleteEventTarget}
        onClose={() => setDeleteEventTarget(null)}
        onConfirm={confirmDeleteEvent}
        title="Delete Event"
        message="Are you sure you want to delete this event?"
        confirmText="Delete Event"
        variant="danger"
        isLoading={deleteEventMutation.isPending}
      />
    </>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  loading?: boolean;
  href?: string;
  variant?: 'default' | 'primary' | 'warning' | 'danger';
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  href,
  variant = 'default',
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    primary: 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400',
    warning: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    danger: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
  };

  const content = (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : value}
          </p>
        </div>
        <div className={`p-2 rounded-lg ${variantStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }

  return content;
}
