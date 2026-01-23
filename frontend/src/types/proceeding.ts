// Proceeding types - court filings within a case

export interface ProceedingJudge {
  person_id: number;
  name: string;
  role: string;  // 'Judge', 'Presiding', 'Panel', 'Magistrate'
  sort_order: number;
}

export interface Proceeding {
  id: number;
  case_id: number;
  case_number: string;
  jurisdiction_id?: number;
  jurisdiction_name?: string;
  local_rules_link?: string;
  // Multi-judge support
  judges: ProceedingJudge[];
  // Backwards compatibility - first judge
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
  is_primary?: boolean;
  notes?: string;
}

export interface UpdateProceedingInput {
  case_number?: string;
  jurisdiction_id?: number | null;
  is_primary?: boolean;
  notes?: string | null;
}

export interface AddProceedingJudgeInput {
  person_id: number;
  role?: string;
  sort_order?: number;
}

export interface UpdateProceedingJudgeInput {
  role?: string;
  sort_order?: number;
}
