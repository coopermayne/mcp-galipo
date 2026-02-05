import type { ExtractCaseInfoResponse, SuggestDocumentNamesResponse, CaseInfo } from '../types/template';
import { getAuthToken, clearAuthToken } from '../context/AuthContext';
import { ApiError, API_BASE } from './common';

/**
 * Upload a PDF file and extract case information using AI.
 *
 * @param file - The PDF file to upload
 * @returns Extracted case info and signing attorney info
 */
export async function extractCaseInfo(file: File): Promise<ExtractCaseInfoResponse> {
  const url = `${API_BASE}/templates/extract`;
  const token = getAuthToken();

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Don't set Content-Type - browser will set it with boundary for multipart/form-data
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
 * Get AI-suggested document name and filename based on case info.
 *
 * @param caseInfo - The case information to base suggestions on
 * @returns Suggested document_name and filename
 */
export async function suggestDocumentNames(caseInfo: CaseInfo): Promise<SuggestDocumentNamesResponse> {
  const url = `${API_BASE}/templates/suggest-names`;
  const token = getAuthToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ case_info: caseInfo }),
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
