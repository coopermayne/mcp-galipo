// Proceeding types - court filings within a case

export interface Proceeding {
  id: number;
  case_id: number;
  case_number: string;
  jurisdiction_id?: number;
  jurisdiction_name?: string;
  local_rules_link?: string;
  judge_id?: number;
  judge_name?: string;
  sort_order: number;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateProceedingInput {
  case_number: string;
  jurisdiction_id?: number;
  judge_id?: number;
  is_primary?: boolean;
  notes?: string;
}

export interface UpdateProceedingInput {
  case_number?: string;
  jurisdiction_id?: number | null;
  judge_id?: number | null;
  is_primary?: boolean;
  notes?: string | null;
}
