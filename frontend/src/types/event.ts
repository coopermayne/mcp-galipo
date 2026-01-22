// Event-related types
// Event represents calendar items: hearings, depositions, filing deadlines, etc.

export interface Event {
  id: number;
  case_id: number;
  case_name?: string;
  short_name?: string;
  date: string;
  time?: string;
  location?: string;
  description: string;
  document_link?: string;
  calculation_note?: string;
  starred?: boolean;
  created_at: string;
}

export interface CreateEventInput {
  case_id: number;
  date: string;
  description: string;
  time?: string;
  location?: string;
  document_link?: string;
  calculation_note?: string;
  starred?: boolean;
}

export interface UpdateEventInput {
  date?: string;
  description?: string;
  time?: string;
  location?: string;
  document_link?: string;
  calculation_note?: string;
  starred?: boolean;
}
