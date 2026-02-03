/**
 * Shared status configuration for task status picker and filter
 *
 * Note: In the task list, status is indicated by SYMBOL and urgency by COLOR.
 * These colors are used in picker/filter UI elements for status identification.
 */
import { Circle, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';
import type { TaskStatus } from '../../types';
import { TASK_STATUS_COLORS } from '../../config/colors';

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
    color: TASK_STATUS_COLORS.Pending.text,
    bgColor: TASK_STATUS_COLORS.Pending.bg,
  },
  {
    value: 'Active',
    label: 'Active',
    icon: Circle, // Placeholder - actual UI uses ActiveStatusIcon
    color: TASK_STATUS_COLORS.Active.text,
    bgColor: TASK_STATUS_COLORS.Active.bg,
  },
  {
    value: 'Done',
    label: 'Done',
    icon: CheckCircle2,
    color: TASK_STATUS_COLORS.Done.text,
    bgColor: TASK_STATUS_COLORS.Done.bg,
  },
  {
    value: 'Blocked',
    label: 'Blocked',
    icon: XCircle,
    color: TASK_STATUS_COLORS.Blocked.text,
    bgColor: TASK_STATUS_COLORS.Blocked.bg,
  },
];

// Helper to get config by status value
export function getStatusConfig(status: TaskStatus): StatusConfig {
  return STATUS_CONFIG.find(s => s.value === status) || STATUS_CONFIG[0];
}

// Default statuses for filter (Done is hidden by default)
export const DEFAULT_STATUS_FILTER: TaskStatus[] = ['Pending', 'Active', 'Blocked'];
