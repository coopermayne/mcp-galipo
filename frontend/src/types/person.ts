export interface ContactInfo {
  value: string
  type?: string
}

export interface RoleBrief {
  id: number
  name: string
  category: string
}

export interface RoleAssignment {
  assignment_id: number
  role_id: number
  case_id: number | null
  attributes: Record<string, unknown>
  role_notes: string | null
  is_primary: boolean | null
  grouped_under_id: number | null
  assigned_date: string | null
  created_at: string | null
  role: RoleBrief
  case_name: string | null
  short_name: string | null
  color: string | null
  grouped_under_name: string | null
}

export interface PersonListItem {
  id: number
  name: string
  phones: ContactInfo[]
  emails: ContactInfo[]
  organization: string | null
  notes: string | null
  archived: boolean | null
  created_at: string | null
  roles?: {
    assignment_id: number
    role_id: number
    role: RoleBrief
    case_id: number | null
    case_name: string | null
    short_name: string | null
    color: string | null
  }[]
}

export interface PersonDetail {
  id: number
  name: string
  phones: ContactInfo[]
  emails: ContactInfo[]
  address: string | null
  organization: string | null
  notes: string | null
  archived: boolean | null
  created_at: string | null
  updated_at: string | null
  roles: RoleAssignment[]
}
