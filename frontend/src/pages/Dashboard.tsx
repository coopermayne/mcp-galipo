import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../components/layout';
import {
  EditableText,
  EditableDate,
  EditableTime,
  ListPanel,
  ConfirmModal,
  CreateTaskButton,
  CreateTaskFromEventModal,
  DeleteEventModal,
} from '../components/common';
import { TaskItem } from '../components/tasks';
import { getStats, getTasks, getEvents, updateTask, deleteTask, updateEvent, deleteEvent } from '../api';
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

// Deterministic color mapping for case badges (used for events)
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
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<number | null>(null);
  const [deleteEventTarget, setDeleteEventTarget] = useState<{ id: number; description: string } | null>(null);
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [taskFromEvent, setTaskFromEvent] = useState<Event | null>(null);

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

  // Tasks are filtered based on toggle
  const displayTasks = tasksData?.tasks || [];

  // Events are already filtered by the API based on showPastEvents
  const displayEvents = eventsData?.events || [];

  const confirmDeleteTask = useCallback(() => {
    if (deleteTaskTarget) {
      deleteTaskMutation.mutate(deleteTaskTarget);
      setDeleteTaskTarget(null);
    }
  }, [deleteTaskTarget, deleteTaskMutation]);

  const handleUpdateEvent = useCallback(
    async (eventId: number, field: string, value: string | null) => {
      await updateEventMutation.mutateAsync({ id: eventId, data: { [field]: value } });
    },
    [updateEventMutation]
  );

  const handleDeleteEvent = useCallback(
    (event: Event) => {
      setDeleteEventTarget({ id: event.id, description: event.description });
    },
    []
  );

  const confirmDeleteEvent = useCallback(() => {
    if (deleteEventTarget) {
      deleteEventMutation.mutate(deleteEventTarget.id);
      setDeleteEventTarget(null);
    }
  }, [deleteEventTarget, deleteEventMutation]);

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
            <ListPanel>
              {tasksLoading ? (
                <ListPanel.Loading />
              ) : displayTasks.length === 0 ? (
                <ListPanel.Empty message={showDoneTasks ? "No completed tasks" : "No pending tasks"} />
              ) : (
                <ListPanel.Body>
                  {displayTasks.slice(0, 8).map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      showCase={true}
                      onMarkDone={(taskId) => updateTaskMutation.mutate({ id: taskId, data: { status: 'Done' } })}
                      onDateChange={(taskId, date) => updateTaskMutation.mutate({ id: taskId, data: { due_date: date || undefined } })}
                      onPriorityChange={(taskId, priority) => updateTaskMutation.mutate({ id: taskId, data: { urgency: priority } })}
                      onDelete={(taskId) => setDeleteTaskTarget(taskId)}
                    />
                  ))}
                </ListPanel.Body>
              )}
            </ListPanel>
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
                      <CreateTaskButton event={event} onClick={() => setTaskFromEvent(event)} />
                      <button
                        onClick={() => handleDeleteEvent(event)}
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

      <DeleteEventModal
        isOpen={!!deleteEventTarget}
        onClose={() => setDeleteEventTarget(null)}
        onConfirm={confirmDeleteEvent}
        eventId={deleteEventTarget?.id ?? null}
        eventDescription={deleteEventTarget?.description ?? ''}
        isLoading={deleteEventMutation.isPending}
      />

      <CreateTaskFromEventModal
        isOpen={!!taskFromEvent}
        onClose={() => setTaskFromEvent(null)}
        event={taskFromEvent}
        caseId={taskFromEvent?.case_id ?? 0}
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
