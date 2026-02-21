// Intake-related types

export type IntakeStatus =
  | 'New'
  | 'Dave Review'
  | 'Needs Follow-Up'
  | 'Atty Review'
  | 'Needs Rejection Letter'
  | 'Rejection Letter Sent'
  | 'Needs Retainer'
  | 'Retainer Sent'
  | 'Retainer Signed'
  | 'Archived';

export const INTAKE_STATUSES: IntakeStatus[] = [
  'New',
  'Dave Review',
  'Needs Follow-Up',
  'Atty Review',
  'Needs Rejection Letter',
  'Rejection Letter Sent',
  'Needs Retainer',
  'Retainer Sent',
  'Retainer Signed',
];

export const INTAKE_TRANSITIONS: Record<IntakeStatus, IntakeStatus[]> = {
  'New': ['Dave Review'],
  'Dave Review': ['Needs Follow-Up', 'Atty Review', 'Needs Rejection Letter', 'Needs Retainer'],
  'Needs Follow-Up': ['Dave Review'],
  'Atty Review': ['Dave Review'],
  'Needs Rejection Letter': ['Rejection Letter Sent'],
  'Rejection Letter Sent': [],  // terminal — archive only
  'Needs Retainer': ['Retainer Sent'],
  'Retainer Sent': ['Retainer Signed'],
  'Retainer Signed': [],  // terminal — archive only
  'Archived': [],
};

export type ActionButtonStyle = 'green' | 'red' | 'blue' | 'amber' | 'indigo' | 'purple' | 'slate';
export type ActionButtonIcon = 'send' | 'scale' | 'circle-help' | 'circle-check' | 'circle-x' | 'mail-check' | 'file-up' | 'file-pen';

export interface IntakeActionButton {
  label: string;
  target: IntakeStatus;
  style: ActionButtonStyle;
  icon: ActionButtonIcon;
}

export const INTAKE_ACTION_BUTTONS: Partial<Record<IntakeStatus, IntakeActionButton[]>> = {
  'New': [
    { label: 'Send to Dave', target: 'Dave Review', icon: 'send', style: 'blue' },
  ],
  'Dave Review': [
    { label: 'Send to Attys', target: 'Atty Review', icon: 'scale', style: 'indigo' },
    { label: 'Needs More Info', target: 'Needs Follow-Up', icon: 'circle-help', style: 'amber' },
    { label: 'Accept', target: 'Needs Retainer', icon: 'circle-check', style: 'green' },
    { label: 'Reject', target: 'Needs Rejection Letter', icon: 'circle-x', style: 'red' },
  ],
  'Needs Follow-Up': [
    { label: 'Send to Dave', target: 'Dave Review', icon: 'send', style: 'blue' },
  ],
  'Atty Review': [
    { label: 'Send to Dave', target: 'Dave Review', icon: 'send', style: 'blue' },
  ],
  'Needs Rejection Letter': [
    { label: 'Letter Sent', target: 'Rejection Letter Sent', icon: 'mail-check', style: 'slate' },
  ],
  'Needs Retainer': [
    { label: 'Retainer Sent', target: 'Retainer Sent', icon: 'file-up', style: 'purple' },
  ],
  'Retainer Sent': [
    { label: 'Retainer Signed', target: 'Retainer Signed', icon: 'file-pen', style: 'green' },
  ],
};

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
  contact_relationship: string | null;
  referral_name: string | null;
  referral_org: string | null;
  referral_email: string | null;
  referral_phone: string | null;
  notes: string | null;
  ai_summary: string | null;
  ai_rating: number | null;
  ai_rating_reasoning: string | null;
  ai_analyzing: boolean;
  has_comment_since_status_change: boolean;
  google_row_number: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface IntakeComment {
  id: number;
  intake_id: number;
  content: string;
  is_system: boolean;
  created_at: string | null;
  user_id: number | null;
  user_first_name: string | null;
  user_last_name: string | null;
  user_initials: string | null;
}

export interface IntakeActivity {
  id: number;
  intake_id: number;
  intake_name: string | null;
  content: string;
  created_at: string | null;
  user_id: number | null;
  user_first_name: string | null;
  user_initials: string | null;
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
