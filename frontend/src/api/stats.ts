import type { DashboardStats, Constants, Jurisdiction } from '../types';
import { request } from './common';

// Stats & Constants
export async function getStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/stats');
}

export async function getConstants(): Promise<Constants> {
  return request<Constants>('/constants');
}

// Jurisdictions
export async function getJurisdictions(): Promise<{ jurisdictions: Jurisdiction[] }> {
  return request('/jurisdictions');
}

export async function createJurisdiction(
  data: { name: string; local_rules_link?: string; notes?: string }
): Promise<{ success: boolean; jurisdiction: Jurisdiction }> {
  return request('/jurisdictions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateJurisdiction(
  jurisdictionId: number,
  data: { name?: string; local_rules_link?: string; notes?: string }
): Promise<{ success: boolean; jurisdiction: Jurisdiction }> {
  return request(`/jurisdictions/${jurisdictionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
