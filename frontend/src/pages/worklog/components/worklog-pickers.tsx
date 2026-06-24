import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, AlertCircleIcon } from "@hugeicons/core-free-icons"
import { getCases } from "@/services/cases"
import { searchPersons } from "@/services/persons"
import { Badge } from "@/components/ui/badge"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox"

interface CaseOption {
  id: number
  case_name: string
  short_name: string | null
}

export function CasePicker({
  value,
  label,
  guess,
  onChange,
}: {
  value: number | null
  label: string | null
  guess: string | null
  onChange: (c: CaseOption | null) => void
}) {
  const { data } = useQuery({
    queryKey: ["cases", "worklog-picker"],
    queryFn: () => getCases({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  })
  const cases = data?.cases ?? []
  const selected = value != null ? cases.find((c) => c.id === value) ?? null : null

  return (
    <div className="space-y-1">
      <Combobox
        value={selected}
        onValueChange={(c: CaseOption | null) => onChange(c)}
        items={cases}
        itemToStringLabel={(c: CaseOption) => c.short_name || c.case_name}
      >
        <ComboboxInput
          placeholder={label ? label : "Match a case…"}
          showClear={!!value}
          showTrigger
          className="text-xs"
        />
        <ComboboxContent>
          <ComboboxList>
            {(c: CaseOption) => (
              <ComboboxItem key={c.id} value={c}>
                <div className="flex flex-col">
                  <span className="text-xs">{c.short_name || c.case_name}</span>
                  {c.short_name && (
                    <span className="text-[10px] text-muted-foreground">{c.case_name}</span>
                  )}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {!value && guess && (
        <span className="flex items-center gap-1 text-[10px] text-warning-foreground">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
          unmatched — “{guess}”
        </span>
      )}
    </div>
  )
}

export function PeopleEditor({
  people,
  onAdd,
  onRemove,
}: {
  people: { id: number; name: string }[]
  onAdd: (p: { id: number; name: string }) => void
  onRemove: (id: number) => void
}) {
  const { data } = useQuery({
    queryKey: ["persons", "worklog-picker"],
    queryFn: () => searchPersons({ limit: 500, include_roles: false }),
    staleTime: 5 * 60 * 1000,
  })
  const options = useMemo(
    () => (data?.persons ?? []).map((p) => ({ id: p.id, name: p.name })),
    [data]
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {people.map((p) => (
        <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
          {p.name}
          <button type="button" onClick={() => onRemove(p.id)} className="hover:text-destructive">
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          </button>
        </Badge>
      ))}
      <div className="w-44">
        <Combobox
          value={null}
          onValueChange={(p: { id: number; name: string } | null) => {
            if (p) onAdd(p)
          }}
          items={options}
          itemToStringLabel={(p: { id: number; name: string }) => p.name}
        >
          <ComboboxInput placeholder="+ person" className="h-7 text-xs" />
          <ComboboxContent>
            <ComboboxList>
              {(p: { id: number; name: string }) => (
                <ComboboxItem key={p.id} value={p}>
                  <span className="text-xs">{p.name}</span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  )
}
