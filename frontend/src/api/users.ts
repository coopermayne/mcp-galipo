import { request } from './common';
import type { User, CreateUserInput, UpdateUserInput } from '../types/user';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface ResetPasswordResponse {
  success: boolean;
  defaultPassword: string;
}

export async function getUsers(includeInactive = false): Promise<User[]> {
  const params = includeInactive ? '?include_inactive=true' : '';
  const response = await request<ApiResponse<User[]>>(`/users${params}`);
  return response.data;
}

export async function getUser(id: number): Promise<User> {
  const response = await request<ApiResponse<User>>(`/users/${id}`);
  return response.data;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const response = await request<ApiResponse<User>>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<User> {
  const response = await request<ApiResponse<User>>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function deleteUser(id: number, hard = false): Promise<void> {
  const params = hard ? '?hard=true' : '';
  await request(`/users/${id}${params}`, {
    method: 'DELETE',
  });
}

export async function resetUserPassword(id: number): Promise<string> {
  const response = await request<ResetPasswordResponse>(`/users/${id}/reset-password`, {
    method: 'POST',
  });
  return response.defaultPassword;
}

interface UserCaseRef {
  id: number;
  case_name: string;
  short_name?: string;
  status: string;
}

export async function getUserCases(
  userId: number,
  role?: 'attorney' | 'paralegal'
): Promise<UserCaseRef[]> {
  const params = role ? `?role=${role}` : '';
  const response = await request<{ success: boolean; data: UserCaseRef[] }>(`/users/${userId}/cases${params}`);
  return response.data;
}
