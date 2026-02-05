// Role types for the unified roles system

export type RoleCategory = 'client' | 'internal_team' | 'opposing_team' | 'third_party';

export interface Role {
  id: number;
  name: string;
  category: RoleCategory;
  sort_order: number;
  description?: string;
  person_count?: number;  // Optional count of persons with this role
}

export interface CreateRoleInput {
  name: string;
  category: RoleCategory;
  sort_order?: number;
  description?: string;
}

export interface UpdateRoleInput {
  name?: string;
  category?: RoleCategory;
  sort_order?: number;
  description?: string;
}
