import type { ExtractCaseInfoResponse } from '../types/template';
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
 * Improve/clean up a document name based on user input and context.
 *
 * @param userInput - What the user has typed (may be empty)
 * @param motionTitle - The title of the uploaded document for context
 * @returns Improved document_name
 */
export async function improveDocumentName(userInput: string, motionTitle: string): Promise<string> {
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

  return data.document_name;
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
