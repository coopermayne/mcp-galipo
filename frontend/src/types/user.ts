export type UserPosition = 'attorney' | 'paralegal' | 'manager' | 'admin';

// Lightweight user reference for nested objects
export interface UserRef {
  id: number;
  firstName: string;
  lastName: string;
  initials: string;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  initials: string;
  barNumber: string | null;
  position: UserPosition;
  isAdmin: boolean;
  mustChangePassword: boolean;
  isActive: boolean;
  paralegalId?: number | null;
  paralegal?: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  initials: string;
  barNumber?: string;
  position: UserPosition;
  isAdmin?: boolean;
  mustChangePassword?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  initials?: string;
  barNumber?: string | null;
  position?: UserPosition;
  isAdmin?: boolean;
  mustChangePassword?: boolean;
  isActive?: boolean;
  paralegalId?: number | null;
}

// Staff user for case assignments (subset of User fields)
export interface CaseStaffUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  initials: string;
  position: UserPosition;
  paralegal_id?: number;
}
