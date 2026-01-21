import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/layout';
import {
  EditableText,
  EditableSelect,
  EditableDate,
  StatusBadge,
  UrgencyBadge,
} from '../components/common';
import {
  getCase,
  getConstants,
  updateCase,
  deleteCase,
  createTask,
  updateTask,
  deleteTask,
  createDeadline,
  updateDeadline,
  deleteDeadline,
  createNote,
  deleteNote,
} from '../api/client';
import type { Case, Task, Deadline, Note, TaskStatus } from '../types';
import {
  Loader2,
  Trash2,
  Plus,
  Users,
  UserCog,
  Building2,
  FileText,
  CheckSquare,
  Clock,
  StickyNote,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

type TabType = 'overview' | 'tasks' | 'deadlines' | 'notes';

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const caseId = parseInt(id || '0', 10);

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => getCase(caseId),
    enabled: !!caseId,
  });

  const { data: constants } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const updateCaseMutation = useMutation({
    mutationFn: (data: Partial<Case>) => updateCase(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: () => deleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      navigate('/cases');
    },
  });

  const handleUpdateField = useCallback(
    async (field: string, value: string | null) => {
      await updateCaseMutation.mutateAsync({ [field]: value });
    },
    [updateCaseMutation]
  );

  const handleDelete = useCallback(() => {
    if (confirm('Are you sure you want to delete this case? This action cannot be undone.')) {
      deleteCaseMutation.mutate();
    }
  }, [deleteCaseMutation]);

  const statusOptions = useMemo(
    () =>
      (constants?.case_statuses || []).map((s) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Case not found</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: FileText },
    { id: 'tasks' as TabType, label: 'Tasks', icon: CheckSquare, count: caseData.tasks?.length },
    { id: 'deadlines' as TabType, label: 'Deadlines', icon: Clock, count: caseData.deadlines?.length },
    { id: 'notes' as TabType, label: 'Notes', icon: StickyNote, count: caseData.notes?.length },
  ];

  return (
    <>
      <Header
        title={
          <EditableText
            value={caseData.case_name}
            onSave={(value) => handleUpdateField('case_name', value)}
            className="text-2xl font-semibold"
          />
        }
        subtitle={
          <div className="flex items-center gap-3 mt-1">
            <EditableSelect
              value={caseData.status}
              options={statusOptions}
              onSave={(value) => handleUpdateField('status', value)}
              renderValue={(value) => <StatusBadge status={value} />}
            />
            {caseData.court && (
              <span className="text-slate-500">{caseData.court}</span>
            )}
          </div>
        }
        actions={
          <button
            onClick={handleDelete}
            className="
              inline-flex items-center gap-2 px-4 py-2
              text-red-600 border border-red-200 rounded-lg
              hover:bg-red-50 transition-colors
              text-sm font-medium
            "
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white px-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 py-3 border-b-2 text-sm font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-slate-100 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            caseData={caseData}
            onUpdateField={handleUpdateField}
          />
        )}
        {activeTab === 'tasks' && (
          <TasksTab caseId={caseId} tasks={caseData.tasks || []} constants={constants} />
        )}
        {activeTab === 'deadlines' && (
          <DeadlinesTab caseId={caseId} deadlines={caseData.deadlines || []} />
        )}
        {activeTab === 'notes' && (
          <NotesTab caseId={caseId} notes={caseData.notes || []} />
        )}
      </div>
    </>
  );
}

// Overview Tab Component
function OverviewTab({
  caseData,
  onUpdateField,
}: {
  caseData: Case;
  onUpdateField: (field: string, value: string | null) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Case Details */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-4">Case Details</h3>
        <div className="space-y-3">
          <Field label="Court">
            <EditableText
              value={caseData.court || ''}
              onSave={(value) => onUpdateField('court', value || null)}
              placeholder="Enter court"
            />
          </Field>
          <Field label="Print Code">
            <EditableText
              value={caseData.print_code || ''}
              onSave={(value) => onUpdateField('print_code', value || null)}
              placeholder="Enter code"
              inputClassName="font-mono"
            />
          </Field>
          <Field label="Date of Injury">
            <EditableDate
              value={caseData.date_of_injury || null}
              onSave={(value) => onUpdateField('date_of_injury', value)}
              placeholder="Select date"
            />
          </Field>
          <Field label="Trial Date">
            <EditableDate
              value={caseData.trial_date || null}
              onSave={(value) => onUpdateField('trial_date', value)}
              placeholder="Select date"
            />
          </Field>
        </div>
      </div>

      {/* Case Summary */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-4">Case Summary</h3>
        <EditableText
          value={caseData.case_summary || ''}
          onSave={(value) => onUpdateField('case_summary', value || null)}
          placeholder="Enter case summary..."
          multiline
          className="w-full"
          inputClassName="w-full min-h-[120px]"
        />
      </div>

      {/* Clients */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-900">Clients/Plaintiffs</h3>
        </div>
        {caseData.clients.length === 0 ? (
          <p className="text-sm text-slate-500">No clients linked</p>
        ) : (
          <div className="space-y-2">
            {caseData.clients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-sm">
                    {client.name}
                    {client.is_primary && (
                      <span className="ml-2 text-xs text-primary-600">(Primary)</span>
                    )}
                  </p>
                  {client.phone && (
                    <p className="text-xs text-slate-500">{client.phone}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Defendants */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-900">Defendants</h3>
        </div>
        {caseData.defendants.length === 0 ? (
          <p className="text-sm text-slate-500">No defendants linked</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {caseData.defendants.map((defendant) => (
              <span
                key={defendant.id}
                className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
              >
                {defendant.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Contacts */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 lg:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <UserCog className="w-4 h-4 text-slate-500" />
          <h3 className="font-semibold text-slate-900">Contacts</h3>
        </div>
        {caseData.contacts.length === 0 ? (
          <p className="text-sm text-slate-500">No contacts linked</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {caseData.contacts.map((contact) => (
              <div
                key={`${contact.id}-${contact.role}`}
                className="p-3 bg-slate-50 rounded-lg"
              >
                <p className="font-medium text-sm">{contact.name}</p>
                {contact.role && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs">
                    {contact.role}
                  </span>
                )}
                {contact.firm && (
                  <p className="text-xs text-slate-500 mt-1">{contact.firm}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tasks Tab Component
function TasksTab({
  caseId,
  tasks,
  constants,
}: {
  caseId: number;
  tasks: Task[];
  constants: any;
}) {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState('');

  const createMutation = useMutation({
    mutationFn: (description: string) =>
      createTask({ case_id: caseId, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewTask('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const taskStatusOptions = useMemo(
    () =>
      (constants?.task_statuses || []).map((s: string) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      createMutation.mutate(newTask.trim());
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Quick Add */}
      <form onSubmit={handleCreate} className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task..."
            className="
              flex-1 px-3 py-2 rounded-lg border border-slate-200
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500
              outline-none text-sm
            "
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newTask.trim()}
            className="
              px-4 py-2 bg-primary-600 text-white rounded-lg
              hover:bg-primary-700 transition-colors
              disabled:opacity-50 text-sm font-medium
              inline-flex items-center gap-2
            "
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </form>

      {/* Task List */}
      <div className="divide-y divide-slate-100">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No tasks</div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50"
            >
              <div className="flex-1 min-w-0">
                <EditableText
                  value={task.description}
                  onSave={(value) =>
                    updateMutation.mutateAsync({ id: task.id, data: { description: value } })
                  }
                  className="text-sm"
                />
              </div>
              <EditableDate
                value={task.due_date || null}
                onSave={(value) =>
                  updateMutation.mutateAsync({ id: task.id, data: { due_date: value || undefined } })
                }
                placeholder="Due date"
              />
              <EditableSelect
                value={task.status}
                options={taskStatusOptions}
                onSave={(value) =>
                  updateMutation.mutateAsync({ id: task.id, data: { status: value as TaskStatus } })
                }
                renderValue={(value) => <StatusBadge status={value} />}
              />
              <UrgencyBadge urgency={task.urgency} />
              <button
                onClick={() => deleteMutation.mutate(task.id)}
                className="p-1 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Deadlines Tab Component
function DeadlinesTab({
  caseId,
  deadlines,
}: {
  caseId: number;
  deadlines: Deadline[];
}) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newDeadline, setNewDeadline] = useState({ date: '', description: '' });

  const createMutation = useMutation({
    mutationFn: () =>
      createDeadline({
        case_id: caseId,
        date: newDeadline.date,
        description: newDeadline.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewDeadline({ date: '', description: '' });
      setIsAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Deadline> }) =>
      updateDeadline(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDeadline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDeadline.date && newDeadline.description.trim()) {
      createMutation.mutate();
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Add Button or Form */}
      <div className="p-4 border-b border-slate-200">
        {isAdding ? (
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={newDeadline.date}
                onChange={(e) => setNewDeadline({ ...newDeadline, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <input
                type="text"
                value={newDeadline.description}
                onChange={(e) => setNewDeadline({ ...newDeadline, description: e.target.value })}
                placeholder="e.g., Discovery cutoff"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending || !newDeadline.date || !newDeadline.description.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-slate-600 rounded-lg text-sm"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="w-4 h-4" />
            Add Deadline
          </button>
        )}
      </div>

      {/* Deadline List */}
      <div className="divide-y divide-slate-100">
        {deadlines.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No deadlines</div>
        ) : (
          deadlines.map((deadline) => (
            <div
              key={deadline.id}
              className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50"
            >
              <EditableDate
                value={deadline.date}
                onSave={(value) =>
                  updateMutation.mutateAsync({ id: deadline.id, data: { date: value || undefined } })
                }
              />
              <div className="flex-1 min-w-0">
                <EditableText
                  value={deadline.description}
                  onSave={(value) =>
                    updateMutation.mutateAsync({ id: deadline.id, data: { description: value } })
                  }
                  className="text-sm"
                />
              </div>
              <StatusBadge status={deadline.status} />
              <UrgencyBadge urgency={deadline.urgency} />
              <button
                onClick={() => deleteMutation.mutate(deadline.id)}
                className="p-1 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Notes Tab Component
function NotesTab({ caseId, notes }: { caseId: number; notes: Note[] }) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');

  const createMutation = useMutation({
    mutationFn: (content: string) => createNote(caseId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewNote('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      createMutation.mutate(newNote.trim());
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM d, yyyy h:mm a') : dateStr;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Add Note */}
      <form onSubmit={handleCreate} className="p-4 border-b border-slate-200">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="
            w-full px-3 py-2 rounded-lg border border-slate-200
            focus:border-primary-500 focus:ring-1 focus:ring-primary-500
            outline-none text-sm resize-none min-h-[80px]
          "
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={createMutation.isPending || !newNote.trim()}
            className="
              px-4 py-2 bg-primary-600 text-white rounded-lg
              hover:bg-primary-700 transition-colors
              disabled:opacity-50 text-sm font-medium
              inline-flex items-center gap-2
            "
          >
            <Plus className="w-4 h-4" />
            Add Note
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="divide-y divide-slate-100">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No notes</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {formatDate(note.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(note.id)}
                  className="p-1 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Field Component
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-slate-500 w-32 shrink-0">{label}</span>
      {children}
    </div>
  );
}
