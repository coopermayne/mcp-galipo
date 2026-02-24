// Timeline-related types for activity log view

import type { Task } from './task';

export interface TimelineItem {
  data: Task;
  sortDate: string;
}
