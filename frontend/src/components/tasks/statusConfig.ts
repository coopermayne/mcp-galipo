/**
 * Shared status configuration for task status picker and filter
 *
 * Note: In the task list, status is indicated by SYMBOL and urgency by COLOR.
 * These colors are used in picker/filter UI elements for status identification.
 */
import { Circle, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';
import type { TaskStatus } from '../../types';

export interface StatusConfig {
  value: TaskStatus;
  label: string;
  icon: LucideIcon;
  color: string;        // Color for picker/filter UI (status identification)
  bgColor: string;      // Background color for selected state
}

// Main statuses shown in picker (excluding "Partially Done" and "Awaiting Atty Review")
export const STATUS_CONFIG: StatusConfig[] = [
  {
    value: 'Pending',
    label: 'Pending',
    icon: Circle,
    color: 'text-slate-500',
    bgColor: 'bg-slate-50 dark:bg-slate-800',
  },
  {
    value: 'Active',
    label: 'Active',
    icon: Circle, // Placeholder - actual UI uses ActiveStatusIcon
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    value: 'Done',
    label: 'Done',
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  {
    value: 'Blocked',
    label: 'Blocked',
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
];

// Helper to get config by status value
export function getStatusConfig(status: TaskStatus): StatusConfig {
  return STATUS_CONFIG.find(s => s.value === status) || STATUS_CONFIG[0];
}

// Default statuses for filter (Done is hidden by default)
export const DEFAULT_STATUS_FILTER: TaskStatus[] = ['Pending', 'Active', 'Blocked'];
