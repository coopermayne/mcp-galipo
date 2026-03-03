import { apiFetch } from "@/lib/api"
import { downloadBlob } from "@/lib/download"
import type {
  ExtractCaseInfoResponse,
  ImproveDocumentNameResponse,
  GenerateFilenameResponse,
  CaseInfo,
  SigningAttorney,
  RFPExtractResponse,
  RFPAnalyzeResponse,
  RFPCaseInfo,
  RFPRequestWithObjections,
  Objection,
  CreateObjectionInput,
  UpdateObjectionInput,
  Attorney,
} from "@/types/template"

// --- Pleading endpoints ---

export async function extractCaseInfo(
  file: File
): Promise<ExtractCaseInfoResponse> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await apiFetch("/api/v1/templates/extract", {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to extract case information")
  return res.json()
}

export async function improveDocumentName(
  userInput: string,
  motionTitle: string
): Promise<ImproveDocumentNameResponse> {
  const res = await apiFetch("/api/v1/templates/improve-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_input: userInput, motion_title: motionTitle }),
  })
  if (!res.ok) throw new Error("Failed to improve document name")
  return res.json()
}

export async function generateFilename(
  documentName: string
): Promise<string> {
  const res = await apiFetch("/api/v1/templates/generate-filename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_name: documentName }),
  })
  if (!res.ok) throw new Error("Failed to generate filename")
  const data: GenerateFilenameResponse = await res.json()
  return data.filename
}

export async function generateDocument(
  caseInfo: CaseInfo,
  signingAttorney: SigningAttorney,
  documentName: string,
  filename: string,
  sections: string[]
): Promise<void> {
  const res = await apiFetch("/api/v1/templates/generate-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      case_info: caseInfo,
      signing_attorney: signingAttorney,
      document_name: documentName,
      filename,
      sections,
    }),
  })
  if (!res.ok) throw new Error("Failed to generate document")
  const blob = await res.blob()
  downloadBlob(blob, filename)
}

// --- RFP endpoints ---

export async function extractRFP(file: File): Promise<RFPExtractResponse> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await apiFetch("/api/v1/rfp/extract", {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to extract RFP")
  return res.json()
}

export async function analyzeRFPRequests(
  requests: { number: number; text: string }[]
): Promise<RFPAnalyzeResponse> {
  const res = await apiFetch("/api/v1/rfp/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  })
  if (!res.ok) throw new Error("Failed to analyze requests")
  return res.json()
}

export async function generateRFPResponse(
  caseInfo: RFPCaseInfo,
  requests: RFPRequestWithObjections[],
  signingAttorney: SigningAttorney,
  filename: string
): Promise<void> {
  const res = await apiFetch("/api/v1/rfp/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      case_info: caseInfo,
      requests,
      signing_attorney: signingAttorney,
      filename,
    }),
  })
  if (!res.ok) throw new Error("Failed to generate RFP response")
  const blob = await res.blob()
  downloadBlob(blob, filename)
}

// --- Objection endpoints ---

export async function getObjections(): Promise<Objection[]> {
  const res = await apiFetch("/api/v1/objections")
  if (!res.ok) throw new Error("Failed to fetch objections")
  const data = await res.json()
  return data.objections
}

export async function createObjection(
  input: CreateObjectionInput
): Promise<Objection> {
  const res = await apiFetch("/api/v1/objections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to create objection")
  const data = await res.json()
  return data.objection
}

export async function updateObjection(
  id: number,
  input: UpdateObjectionInput
): Promise<Objection> {
  const res = await apiFetch(`/api/v1/objections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to update objection")
  const data = await res.json()
  return data.objection
}

export async function deleteObjection(id: number): Promise<void> {
  const res = await apiFetch(`/api/v1/objections/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete objection")
}

export async function reorderObjections(
  orderedIds: number[]
): Promise<Objection[]> {
  const res = await apiFetch("/api/v1/objections/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordered_ids: orderedIds }),
  })
  if (!res.ok) throw new Error("Failed to reorder objections")
  const data = await res.json()
  return data.objections
}

// --- Attorney endpoint ---

export async function getAttorneys(): Promise<Attorney[]> {
  const res = await apiFetch("/api/v1/attorneys")
  if (!res.ok) throw new Error("Failed to fetch attorneys")
  const data = await res.json()
  return data.data
}

