// Activity-related types

export interface Activity {
  id: number;
  case_id: number;
  description: string;
  type: string;
  date: string;
  minutes?: number;
  created_at: string;
}

export interface CreateActivityInput {
  case_id: number;
  description: string;
  activity_type: string;
  date?: string;
  minutes?: number;
}

export interface UpdateActivityInput {
  description?: string;
  activity_type?: string;
  date?: string;
  minutes?: number;
}
