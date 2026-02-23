// Pleading types

export interface CaseInfo {
  court: string | null
  case_number: string | null
  plaintiffs: string | null
  defendants: string | null
  judge: string | null
  magistrate_judge: string | null
  motion_title: string | null
  hearing_date: string | null
  hearing_time: string | null
  courtroom: string | null
}

export interface SigningAttorney {
  name: string
  bar_number: string | null
  email: string
}

export interface ExtractCaseInfoResponse {
  success: boolean
  case_info: CaseInfo
  signing_attorney: SigningAttorney | null
}

export interface ImproveDocumentNameResponse {
  success: boolean
  document_name: string
  sections: string[]
}

export interface GenerateFilenameResponse {
  success: boolean
  filename: string
}

// RFP types

export interface RFPCaseInfo {
  court_name: string | null
  case_no: string | null
  header_plaintiffs: string | null
  header_defendants: string | null
  propounding_party: string | null
  responding_party: string | null
  set_number: string | null
  document_title: string | null
  response_document_title: string | null
  multiple_plaintiffs: boolean
  multiple_defendants: boolean
}

export interface RFPRequest {
  number: number
  text: string
}

export interface RFPRequestWithObjections extends RFPRequest {
  objection_short_names: string[]
  will_produce: boolean
  withheld_on_objections: boolean
}

export interface RFPExtractResponse {
  success: boolean
  case_info: RFPCaseInfo
  requests: RFPRequest[]
  signing_attorney: SigningAttorney | null
}

export interface RFPAnalyzeResponse {
  success: boolean
  analyses: Record<string, { objections: string[] }>
}

// Objection types

export interface Objection {
  id: number
  name: string
  short_name: string
  formal_language: string
  ai_notes?: string
  position?: number
}

export interface CreateObjectionInput {
  name: string
  short_name: string
  formal_language: string
  ai_notes?: string
  position?: number
}

export interface UpdateObjectionInput {
  name?: string
  short_name?: string
  formal_language?: string
  ai_notes?: string
  position?: number
}

// Attorney type (shared across templates)

export interface Attorney {
  id: number
  firstName: string
  lastName: string
  initials: string
  barNumber?: string | null
  email?: string | null
}
