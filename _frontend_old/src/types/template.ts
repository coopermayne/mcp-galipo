// Template-related types for PDF extraction and case info

export interface CaseInfo {
  court: string | null;
  case_number: string | null;
  plaintiffs: string | null;
  defendants: string | null;
  judge: string | null;
  magistrate_judge: string | null;
  motion_title: string | null;
  hearing_date: string | null;
  hearing_time: string | null;
  courtroom: string | null;
}

export interface SigningAttorney {
  name: string;
  bar_number: string | null;
  email: string;
}

export interface ExtractCaseInfoResponse {
  success: boolean;
  case_info: CaseInfo;
  signing_attorney: SigningAttorney;
}
