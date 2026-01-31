/**
 * Chat mode configuration.
 *
 * Defines the available chat modes with their UI properties,
 * suggested questions, and dashboard presets.
 */

import type { LucideIcon } from 'lucide-react';
import { CheckSquare, Calendar, Users, BarChart3, Sparkles, Clock, AlertTriangle, Activity } from 'lucide-react';

export type ChatMode = 'tasks' | 'events' | 'people' | 'overview' | 'full';

export interface ChatModeConfig {
  id: ChatMode;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string; // Tailwind color class prefix (e.g., 'blue' -> 'bg-blue-500')
  suggestedQuestions: string[];
}

export type PresetId = 'priorities' | 'deadlines' | 'overdue' | 'activity';

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
    id: 'priorities',
    label: 'My Priorities',
    description: 'What should I focus on today?',
    icon: Sparkles,
    color: 'blue',
  },
  {
    id: 'deadlines',
    label: 'Upcoming Deadlines',
    description: 'Events and deadlines in the next 14 days',
    icon: Clock,
    color: 'green',
  },
  {
    id: 'activity',
    label: 'Recent Activity',
    description: 'What has been completed recently',
    icon: Activity,
    color: 'purple',
  },
  {
    id: 'overdue',
    label: 'Overdue Items',
    description: 'Tasks and events needing attention',
    icon: AlertTriangle,
    color: 'red',
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

/**
 * Get the case-context modes (excludes 'full').
 */
export function getCaseModes(): ChatModeConfig[] {
  return [CHAT_MODES.tasks, CHAT_MODES.events, CHAT_MODES.people];
}
