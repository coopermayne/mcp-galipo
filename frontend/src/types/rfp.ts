// RFP-related types for extraction, analysis, and generation

export interface RFPCaseInfo {
  court_name: string | null;
  header_plaintiffs: string | null;
  header_defendants: string | null;
  case_no: string | null;
  propounding_party: string | null;
  responding_party: string | null;
  set_number: string | null;
  document_title: string | null;
  multiple_plaintiffs: boolean;
  multiple_defendants: boolean;
}

export interface RFPRequest {
  number: number;
  text: string;
}

export interface RFPRequestWithObjections extends RFPRequest {
  objection_short_names: string[];
  will_produce: boolean;
  withheld_on_objections: boolean;
}

export interface Objection {
  id: number;
  name: string;
  short_name: string;
  formal_language: string;
  argument_template: string | null;
  position: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface RFPExtractResponse {
  success: boolean;
  case_info: RFPCaseInfo;
  requests: RFPRequest[];
  signing_attorney: {
    name: string;
    bar_number: string | null;
    email: string;
  };
}

export interface RFPAnalyzeResponse {
  success: boolean;
  analyses: Record<string, { objections: string[] }>;
}
