// Judge types - standalone judge entities (separate from persons)

import type { PhoneEntry, EmailEntry } from './common';

export interface Judge {
  id: number;
  name: string;
  title?: string;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  jurisdiction_id?: number;
  jurisdiction_name?: string;
  chambers?: string;
  courtroom_number?: string;
  appointed_by?: string;
  appointed_date?: string;
  initials?: string;
  status?: string;  // Active, Retired, Deceased, etc.
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Optional: proceedings this judge is assigned to
  proceedings?: JudgeProceeding[];
  // Fuzzy search fields (present when result came from fuzzy matching)
  score?: number;
  fuzzy_match?: boolean;
}

export interface JudgeProceeding {
  proceeding_id: number;
  case_id: number;
  case_name: string;
  case_number: string;
  role: string;  // Presiding, Magistrate, Panel, Other
}

export interface CreateJudgeInput {
  name: string;
  title?: string;
  phones?: PhoneEntry[];
  emails?: EmailEntry[];
  jurisdiction_id?: number;
  chambers?: string;
  courtroom_number?: string;
  appointed_by?: string;
  appointed_date?: string;
  initials?: string;
  status?: string;
  notes?: string;
}

export interface UpdateJudgeInput {
  name?: string;
  title?: string | null;
  phones?: PhoneEntry[];
  emails?: EmailEntry[];
  jurisdiction_id?: number | null;
  chambers?: string | null;
  courtroom_number?: string | null;
  appointed_by?: string | null;
  appointed_date?: string | null;
  initials?: string | null;
  status?: string;
  notes?: string | null;
}
