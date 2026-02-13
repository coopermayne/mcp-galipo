import type { RFPExtractResponse, RFPAnalyzeResponse, RFPRequest, RFPCaseInfo, RFPRequestWithObjections } from '../types/rfp';
import type { SigningAttorney } from '../types/template';
import { getAuthToken, clearAuthToken } from '../context/AuthContext';
import { ApiError, API_BASE } from './common';

/**
 * Upload an RFP PDF and extract case info + requests using AI.
 */
export async function extractRFP(file: File): Promise<RFPExtractResponse> {
  const url = `${API_BASE}/rfp/extract`;
  const token = getAuthToken();

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
    }
    const error = data.error || { message: 'Unknown error', code: 'UNKNOWN' };
    throw new ApiError(error.message, error.code, response.status);
  }

  return data;
}

/**
 * Analyze RFP requests and get suggested objections.
 */
export async function analyzeRFPRequests(requests: RFPRequest[]): Promise<RFPAnalyzeResponse> {
  const url = `${API_BASE}/rfp/analyze`;
  const token = getAuthToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ requests }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
    }
    const error = data.error || { message: 'Unknown error', code: 'UNKNOWN' };
    throw new ApiError(error.message, error.code, response.status);
  }

  return data;
}

/**
 * Generate an RFP response DOCX and trigger download.
 */
export async function generateRFPResponse(
  caseInfo: RFPCaseInfo,
  requests: RFPRequestWithObjections[],
  signingAttorney: SigningAttorney,
  filename: string,
): Promise<void> {
  const url = `${API_BASE}/rfp/generate`;
  const token = getAuthToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      case_info: caseInfo,
      requests: requests.map(r => ({
        number: r.number,
        text: r.text,
        objection_short_names: r.objection_short_names,
        will_produce: r.will_produce,
        withheld_on_objections: r.withheld_on_objections,
      })),
      signing_attorney: signingAttorney,
      filename,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
    }
    const data = await response.json();
    const error = data.error || { message: 'Unknown error', code: 'UNKNOWN' };
    throw new ApiError(error.message, error.code, response.status);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
