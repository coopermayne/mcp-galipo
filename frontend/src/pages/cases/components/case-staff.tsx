import type { CaseStaffUser } from "@/types/case"

interface CaseStaffProps {
  attorneys: CaseStaffUser[]
  paralegals: CaseStaffUser[]
}

function StaffCard({ user, role }: { user: CaseStaffUser; role: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex size-8 shrink-0 items-center justify-center bg-muted text-xs font-medium">
        {user.initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">
          {user.first_name} {user.last_name}
        </p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
    </div>
  )
}

export function CaseStaff({ attorneys, paralegals }: CaseStaffProps) {
  const hasStaff = attorneys.length > 0 || paralegals.length > 0

  return (
    <div className="border p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Staff
      </h2>
      {!hasStaff ? (
        <p className="text-sm text-muted-foreground">No staff assigned.</p>
      ) : (
        <div className="space-y-1 divide-y">
          {attorneys.map((u) => (
            <StaffCard key={u.id} user={u} role="Attorney" />
          ))}
          {paralegals.map((u) => (
            <StaffCard key={u.id} user={u} role="Paralegal" />
          ))}
        </div>
      )}
    </div>
  )
}
