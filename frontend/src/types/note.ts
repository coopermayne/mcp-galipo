// Note-related types

export interface Note {
  id: number;
  case_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteInput {
  case_id: number;
  content: string;
}
