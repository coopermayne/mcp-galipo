/**
 * Chat mode configuration.
 *
 * Defines the available chat modes with their UI properties,
 * suggested questions, and dashboard presets.
 */

import type { LucideIcon } from 'lucide-react';
import { CheckSquare, Calendar, Users, BarChart3, Sparkles, Clock, AlertTriangle, Activity, Scale, UserPlus } from 'lucide-react';

export type ChatMode = 'tasks' | 'events' | 'people' | 'proceedings' | 'intakes' | 'overview' | 'full';

export interface ChatModeConfig {
  id: ChatMode;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string; // Tailwind color class prefix (e.g., 'blue' -> 'bg-blue-500')
  suggestedQuestions: string[];
}

export type PresetId = 'priorities' | 'deadlines' | 'overdue' | 'activity' | 'sol_watch' | 'stale_intakes' | 'needs_attention';
export type CasePresetId = 'case_summary' | 'case_next' | 'case_tasks' | 'case_events';
export type ActionStarterId = 'add_events' | 'add_people' | 'add_tasks' | 'manage_proceedings';

export interface CasePreset {
  id: CasePresetId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export interface ActionStarter {
  id: ActionStarterId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  mode: ChatMode;  // The mode to activate (filters tools)
  greeting: string;  // Static greeting shown immediately (no API call)
}

export type DashboardActionStarterId = 'new_intake';

export interface DashboardActionStarter {
  id: DashboardActionStarterId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  mode: ChatMode;
  greeting: string;
}

/**
 * Dashboard action starters - available from the dashboard (no case context).
 */
export const DASHBOARD_ACTION_STARTERS: DashboardActionStarter[] = [
  {
    id: 'new_intake',
    label: 'New Intake',
    description: 'Create an intake from a voicemail, email, or notes',
    icon: UserPlus,
    color: 'green',
    mode: 'intakes',
    greeting: 'Paste the voicemail transcript, email, or notes below and I\'ll extract the contact and incident details to create a new intake.',
  },
];

/**
 * Action starters - interactive modes for adding/managing data.
 * These activate focused tool sets and enable the chat input.
 */
export const ACTION_STARTERS: ActionStarter[] = [
  {
    id: 'add_events',
    label: 'Add Events',
    description: 'Schedule hearings, depositions, deadlines',
    icon: Calendar,
    color: 'green',
    mode: 'events',
    greeting: 'What events would you like to add? You can list multiple at once — e.g. "Deposition March 20 at 10am, Mediation April 5 at 9am"',
  },
  {
    id: 'add_people',
    label: 'Add People',
    description: 'Add attorneys, experts, witnesses',
    icon: Users,
    color: 'purple',
    mode: 'people',
    greeting: 'Who would you like to add to this case? Include their name and role — e.g. "Dr. Smith as plaintiff expert" or "Jane Doe as opposing counsel"',
  },
  {
    id: 'add_tasks',
    label: 'Add Tasks',
    description: 'Create tasks and to-dos',
    icon: CheckSquare,
    color: 'blue',
    mode: 'tasks',
    greeting: 'What tasks would you like to add? You can list multiple — e.g. "Draft interrogatories by Friday, Review medical records high priority"',
  },
  {
    id: 'manage_proceedings',
    label: 'Proceedings',
    description: 'Manage court proceedings, judges, jurisdictions',
    icon: Scale,
    color: 'slate',
    mode: 'proceedings',
    greeting: 'What would you like to do with proceedings? I can create proceedings, look up or add judges, and assign judges to proceedings. For example: "Add proceeding 24STCV12345 in Los Angeles Superior" or "Create judge Hon. Jane Wilson"',
  },
];

/**
 * Case-specific presets shown when on a case page.
 */
export const CASE_PRESETS: CasePreset[] = [
  {
    id: 'case_summary',
    label: 'Case Overview',
    description: 'Status, progress, and key info',
    icon: BarChart3,
    color: 'blue',
  },
  {
    id: 'case_next',
    label: 'Next Steps',
    description: 'What should I do next?',
    icon: Sparkles,
    color: 'purple',
  },
  {
    id: 'case_tasks',
    label: 'Task Status',
    description: 'Incomplete and overdue tasks',
    icon: CheckSquare,
    color: 'green',
  },
  {
    id: 'case_events',
    label: 'Schedule',
    description: 'Upcoming events and deadlines',
    icon: Calendar,
    color: 'amber',
  },
];

export interface DashboardPreset {
  id: PresetId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

/**
 * Mode configurations for case context chat.
 */
export const CHAT_MODES: Record<ChatMode, ChatModeConfig> = {
  tasks: {
    id: 'tasks',
    label: 'Tasks',
    description: 'Manage tasks, deadlines, priorities',
    icon: CheckSquare,
    color: 'blue',
    suggestedQuestions: [
      'What tasks are due this week?',
      'Show me incomplete tasks for this case',
      'Add a task to follow up with the client',
      'Mark all discovery tasks as complete',
      'What are the highest priority tasks?',
    ],
  },
  events: {
    id: 'events',
    label: 'Events',
    description: 'Manage calendar and scheduling',
    icon: Calendar,
    color: 'green',
    suggestedQuestions: [
      'What events are scheduled this month?',
      'Schedule a deposition for next Tuesday',
      'When is the next hearing?',
      'Show all upcoming deadlines',
      'Reschedule the mediation to next week',
    ],
  },
  people: {
    id: 'people',
    label: 'People',
    description: 'Manage contacts and participants',
    icon: Users,
    color: 'purple',
    suggestedQuestions: [
      'Who is assigned to this case?',
      'Add an expert witness',
      'Show all attorneys on this case',
      'Update the client contact information',
      'Assign Dr. Smith as medical expert',
    ],
  },
  proceedings: {
    id: 'proceedings',
    label: 'Proceedings',
    description: 'Manage court proceedings and judges',
    icon: Scale,
    color: 'slate',
    suggestedQuestions: [
      'What proceedings are on this case?',
      'Add a proceeding with case number 24STCV12345',
      'List all available jurisdictions',
      'Search for Judge Wilson',
      'Assign a judge to the proceeding',
    ],
  },
  intakes: {
    id: 'intakes',
    label: 'Intakes',
    description: 'Create intakes from unstructured text',
    icon: UserPlus,
    color: 'green',
    suggestedQuestions: [
      'Create an intake from this voicemail',
      'Log a new potential client',
      'Add this email as an intake',
    ],
  },
  overview: {
    id: 'overview',
    label: 'Overview',
    description: 'Case summaries and insights',
    icon: BarChart3,
    color: 'amber',
    suggestedQuestions: [
      'Give me a summary of this case',
      'What has happened recently?',
      'What should I prioritize?',
      'Show recent activity',
    ],
  },
  full: {
    id: 'full',
    label: 'Full Access',
    description: 'All tools available',
    icon: Sparkles,
    color: 'slate',
    suggestedQuestions: [],
  },
};

/**
 * Dashboard presets for non-case context chat.
 * Data is pre-fetched by the backend - no tool calls needed.
 */
export const DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    id: 'sol_watch',
    label: 'SOL Watch',
    description: 'Cases approaching statute of limitations',
    icon: AlertTriangle,
    color: 'red',
  },
  {
    id: 'stale_intakes',
    label: 'Unreviewed Intakes',
    description: 'New intakes waiting to be processed',
    icon: Clock,
    color: 'amber',
  },
  {
    id: 'needs_attention',
    label: 'Needs Attention',
    description: 'Overdue tasks, urgent items, stale cases',
    icon: Activity,
    color: 'purple',
  },
];

/**
 * Get the Tailwind classes for a mode's color.
 */
export function getModeColorClasses(color: string): {
  bg: string;
  bgLight: string;
  text: string;
  border: string;
  hover: string;
} {
  const colorMap: Record<string, { bg: string; bgLight: string; text: string; border: string; hover: string }> = {
    blue: {
      bg: 'bg-blue-600',
      bgLight: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
    },
    green: {
      bg: 'bg-green-600',
      bgLight: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800',
      hover: 'hover:bg-green-100 dark:hover:bg-green-900/30',
    },
    purple: {
      bg: 'bg-purple-600',
      bgLight: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-800',
      hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30',
    },
    amber: {
      bg: 'bg-amber-600',
      bgLight: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30',
    },
    red: {
      bg: 'bg-red-600',
      bgLight: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      hover: 'hover:bg-red-100 dark:hover:bg-red-900/30',
    },
    slate: {
      bg: 'bg-slate-600',
      bgLight: 'bg-slate-50 dark:bg-slate-800',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-200 dark:border-slate-700',
      hover: 'hover:bg-slate-100 dark:hover:bg-slate-700',
    },
  };

  return colorMap[color] || colorMap.slate;
}
