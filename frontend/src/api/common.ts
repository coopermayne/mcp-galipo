import { getAuthToken, clearAuthToken } from '../context/AuthContext';

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    // Handle 401 by clearing token and redirecting to login
    if (response.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
    }
    const error = data.error || { message: 'Unknown error', code: 'UNKNOWN' };
    throw new ApiError(error.message, error.code, response.status);
  }

  return data;
}
