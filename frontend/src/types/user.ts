export type UserPosition = 'attorney' | 'paralegal' | 'manager' | 'admin';

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
}
