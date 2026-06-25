import type { ColumnDef } from "@tanstack/react-table"
import type { User } from "@/types/user"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalCircle01Icon,
  PencilEdit01Icon,
  ResetPasswordIcon,
  UserBlock01Icon,
} from "@hugeicons/core-free-icons"
import { DataTableColumnHeader } from "@/components/common/data-table-column-header"
import { getAvatarStyleById } from "@/lib/badge-colors"
import { timeAgo } from "@/lib/datetime"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const POSITION_LABELS: Record<string, string> = {
  attorney: "Attorney",
  paralegal: "Paralegal",
  manager: "Manager",
  admin: "Admin",
}

export function getColumns(options: {
  onEdit: (user: User) => void
  onResetPassword: (user: User) => void
  onDeactivate: (user: User) => void
}): ColumnDef<User>[] {
  return [
    {
      accessorKey: "lastName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        const { firstName, lastName, initials } = row.original
        const name = [firstName, lastName].filter(Boolean).join(" ") || "—"
        return (
          <div className="flex items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center text-[10px] font-medium"
              style={getAvatarStyleById(row.original.id)}
            >
              {initials || "?"}
            </span>
            <span className="font-medium">{name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
    },
    {
      accessorKey: "position",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Position" />
      ),
      cell: ({ row }) =>
        POSITION_LABELS[row.original.position ?? ""] ?? "—",
    },
    {
      accessorKey: "isAdmin",
      header: "Admin",
      cell: ({ row }) =>
        row.original.isAdmin ? (
          <Badge variant="secondary">Admin</Badge>
        ) : null,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="destructive">Inactive</Badge>
        ),
    },
    {
      accessorKey: "mustChangePassword",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Password" />
      ),
      cell: ({ row }) =>
        row.original.mustChangePassword ? (
          <Badge className="border-warning/30 bg-warning/15 text-warning">
            Default
          </Badge>
        ) : (
          <span className="text-muted-foreground">Set</span>
        ),
    },
    {
      accessorKey: "lastActiveAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Active" />
      ),
      cell: ({ row }) => {
        const last = row.original.lastActiveAt
        return (
          <span className={last ? undefined : "text-muted-foreground"}>
            {last ? timeAgo(last) : "Never"}
          </span>
        )
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 p-0">
              <HugeiconsIcon
                icon={MoreHorizontalCircle01Icon}
                className="size-4"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => options.onEdit(row.original)}>
              <HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => options.onResetPassword(row.original)}
            >
              <HugeiconsIcon icon={ResetPasswordIcon} className="mr-2 size-4" />
              Reset Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => options.onDeactivate(row.original)}
              className="text-destructive focus:text-destructive"
            >
              <HugeiconsIcon icon={UserBlock01Icon} className="mr-2 size-4" />
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      ),
    },
  ]
}
