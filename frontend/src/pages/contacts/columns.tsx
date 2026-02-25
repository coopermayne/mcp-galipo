import type { ColumnDef } from "@tanstack/react-table"
import type { PersonListItem } from "@/types/person"
import { formatRoleName } from "@/pages/contacts/contact-data"

export function getColumns(): ColumnDef<PersonListItem>[] {
  return [
    {
      accessorKey: "name",
      filterFn: (row, _id, value: string) => {
        const q = value.toLowerCase()
        const name = (row.original.name ?? "").toLowerCase()
        const org = (row.original.organization ?? "").toLowerCase()
        const roles = (row.original.roles ?? [])
          .map((r) => formatRoleName(r.role.name))
          .join(" ")
          .toLowerCase()
        const phones = (row.original.phones ?? [])
          .map((p) => p.value)
          .join(" ")
          .toLowerCase()
        const emails = (row.original.emails ?? [])
          .map((e) => e.value)
          .join(" ")
          .toLowerCase()
        return (
          name.includes(q) ||
          org.includes(q) ||
          roles.includes(q) ||
          phones.includes(q) ||
          emails.includes(q)
        )
      },
    },
    {
      id: "organization",
      accessorFn: (row) => row.organization ?? "",
    },
    {
      id: "category",
      accessorFn: (row) => {
        const categories = new Set(
          (row.roles ?? []).map((r) => r.role.category)
        )
        return Array.from(categories).join(",")
      },
      filterFn: (row, _id, value: string) => {
        if (!value) return true
        const categories = (row.original.roles ?? []).map(
          (r) => r.role.category
        )
        return categories.includes(value)
      },
    },
  ]
}
