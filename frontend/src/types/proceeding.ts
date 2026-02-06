// Proceeding types - court filings within a case

export interface ProceedingJudge {
  judge_id: number;
  name: string;
  role: string;  // 'Judge', 'Presiding', 'Panel', 'Magistrate Judge'
  sort_order: number;
  initials?: string;
  chambers?: string;
}

export interface Proceeding {
  id: number;
  case_id: number;
  case_number: string;
  jurisdiction_id?: number;
  jurisdiction_name?: string;
  local_rules_link?: string;
  // CourtListener integration
  courtlistener_docket_id?: number;
  pacer_case_id?: string;
  // Multi-judge support (from judges table)
  judges: ProceedingJudge[];
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
  courtlistener_docket_id?: number;
  pacer_case_id?: string;
}

export interface UpdateProceedingInput {
  case_number?: string;
  jurisdiction_id?: number | null;
  is_primary?: boolean;
  notes?: string | null;
  courtlistener_docket_id?: number | null;
  pacer_case_id?: string | null;
}

export interface AddProceedingJudgeInput {
  judge_id: number;
  role?: string;
  sort_order?: number;
}

export interface UpdateProceedingJudgeInput {
  role?: string;
  sort_order?: number;
}
