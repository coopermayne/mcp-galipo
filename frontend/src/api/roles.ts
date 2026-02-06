import type { Role, RoleCategory, CreateRoleInput, UpdateRoleInput } from '../types';
import { request } from './common';

// Roles API

export async function getRoles(params?: {
  category?: RoleCategory;
}): Promise<{ success: boolean; roles: Role[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  const query = searchParams.toString();
  return request(`/roles${query ? `?${query}` : ''}`);
}

export async function getRole(roleId: number): Promise<{ success: boolean; role: Role }> {
  return request(`/roles/${roleId}`);
}

export async function createRole(data: CreateRoleInput): Promise<{ success: boolean; role: Role }> {
  return request('/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(
  roleId: number,
  data: UpdateRoleInput
): Promise<{ success: boolean; role: Role }> {
  return request(`/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(roleId: number): Promise<{ success: boolean; error?: string }> {
  return request(`/roles/${roleId}`, {
    method: 'DELETE',
  });
}
