// Timeline-related types for unified activity view

import type { Activity } from './activity';
import type { Task } from './task';

export interface ActivityTimelineItem {
  type: 'activity';
  data: Activity;
  sortDate: string;
}

export interface TaskTimelineItem {
  type: 'completed_task';
  data: Task;
  sortDate: string;
}

export type TimelineItem = ActivityTimelineItem | TaskTimelineItem;
