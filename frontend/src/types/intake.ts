// Intake-related types

export type IntakeStatus =
  | 'New'
  | 'Screened'
  | 'Needs Follow-Up'
  | 'Atty Review'
  | 'Rejected'
  | 'Rejection Sent'
  | 'Send Retainer'
  | 'Retainer Sent'
  | 'Retained'
  | 'Archived';

export const INTAKE_STATUSES: IntakeStatus[] = [
  'New',
  'Screened',
  'Needs Follow-Up',
  'Atty Review',
  'Rejected',
  'Rejection Sent',
  'Send Retainer',
  'Retainer Sent',
  'Retained',
];

export interface Intake {
  id: number;
  submitted_on: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  case_type: string | null;
  incident_date: string | null;
  incident_time: string | null;
  location: string | null;
  incident_description: string | null;
  injury_description: string | null;
  disclaimer_accepted: boolean | null;
  status: IntakeStatus;
  notes: string | null;
  ai_summary: string | null;
  ai_rating: number | null;
  ai_rating_reasoning: string | null;
  google_row_number: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface UpdateIntakeInput {
  status?: IntakeStatus;
  notes?: string;
}

export interface SyncResult {
  success: boolean;
  imported: number;
  skipped: number;
  total: number;
}
