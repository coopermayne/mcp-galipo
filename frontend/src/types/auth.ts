export interface AuthUser {
  id: number
  email: string
  firstName: string
  lastName: string
  initials: string
  position: string
  isAdmin: boolean
  paralegalId: number | null
}

export interface LoginResponse {
  success: boolean
  token: string
  user: AuthUser
  mustChangePassword: boolean
  error?: { message: string; code: string }
}

export interface VerifyResponse {
  success: boolean
  valid: boolean
  user: AuthUser
  error?: { message: string; code: string }
}
