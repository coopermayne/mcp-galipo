import type { ExtractCaseInfoResponse, CaseInfo, SigningAttorney } from '../types/template';
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

export interface ImproveDocumentNameResponse {
  document_name: string;
  sections: string[];
}

/**
 * Improve/clean up a document name based on user input and context.
 *
 * @param userInput - What the user has typed (may be empty)
 * @param motionTitle - The title of the uploaded document for context
 * @returns Object with improved document_name and recommended sections
 */
export async function improveDocumentName(userInput: string, motionTitle: string): Promise<ImproveDocumentNameResponse> {
  const url = `${API_BASE}/templates/improve-name`;
  const token = getAuthToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ user_input: userInput, motion_title: motionTitle }),
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

  return {
    document_name: data.document_name,
    sections: data.sections || [],
  };
}

/**
 * Generate a filename from a document name.
 *
 * @param documentName - The formal document title
 * @returns Generated filename
 */
export async function generateFilename(documentName: string): Promise<string> {
  const url = `${API_BASE}/templates/generate-filename`;
  const token = getAuthToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ document_name: documentName }),
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

  return data.filename;
}

/**
 * Generate a pleading document and trigger download.
 *
 * @param caseInfo - Case information from extraction
 * @param signingAttorney - Attorney info for signature block
 * @param documentName - Title for the document
 * @param filename - Desired filename for download
 * @param sections - Array of section keys to include (e.g., ['toc', 'toa', 'cert_compliance'])
 */
export async function generateDocument(
  caseInfo: CaseInfo,
  signingAttorney: SigningAttorney,
  documentName: string,
  filename: string,
  sections: string[]
): Promise<void> {
  const url = `${API_BASE}/templates/generate-document`;
  const token = getAuthToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      case_info: caseInfo,
      signing_attorney: signingAttorney,
      document_name: documentName,
      filename: filename,
      sections: sections,
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

  // Get the blob and trigger download
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
