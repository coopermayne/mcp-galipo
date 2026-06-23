import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, AlertCircleIcon, Delete02Icon } from "@hugeicons/core-free-icons"
import { getCases } from "@/services/cases"
import { searchPersons } from "@/services/persons"
import { formatMinutes } from "@/services/worklog"
import type { Worklog, WorklogEntryInput } from "@/types/worklog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox"
import { cn } from "@/lib/utils"

const DAY_CEILING_MIN = 420 // 7h

interface DraftEntry extends WorklogEntryInput {
  _key: string
  case_name: string | null
  short_name: string | null
  people: { id: number; name: string }[]
}

interface WorklogReviewProps {
  worklog: Worklog
  onConfirm: (entries: WorklogEntryInput[]) => void
  onDiscard: () => void
  isSaving: boolean
}

export function WorklogReview({ worklog, onConfirm, onDiscard, isSaving }: WorklogReviewProps) {
  const [entries, setEntries] = useState<DraftEntry[]>(() =>
    worklog.entries.map((e, i) => ({
      _key: `${e.id}-${i}`,
      case_id: e.case_id,
      minutes: e.minutes,
      description: e.description,
      raw_reference: e.raw_reference,
      person_ids: e.people.map((p) => p.id),
      case_name: e.case_name,
      short_name: e.short_name,
      people: e.people,
    }))
  )

  const { data: casesData } = useQuery({
    queryKey: ["cases", "worklog-picker"],
    queryFn: () => getCases({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  })
  const cases = casesData?.cases ?? []

  const total = useMemo(() => entries.reduce((s, e) => s + (e.minutes || 0), 0), [entries])
  const overCeiling = total > DAY_CEILING_MIN

  function patch(key: string, fields: Partial<DraftEntry>) {
    setEntries((prev) => prev.map((e) => (e._key === key ? { ...e, ...fields } : e)))
  }

  function removeEntry(key: string) {
    setEntries((prev) => prev.filter((e) => e._key !== key))
  }

  function handleConfirm() {
    onConfirm(
      entries.map((e) => ({
        case_id: e.case_id,
        minutes: e.minutes,
        description: e.description,
        raw_reference: e.raw_reference,
        person_ids: e.person_ids,
      }))
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Review and fix the consolidated entries, then confirm. Only confirmed entries count toward case totals.
        </p>
      </div>

      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e._key} className="border p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <Input
                value={e.description}
                onChange={(ev) => patch(e._key, { description: ev.target.value })}
                className="flex-1"
                placeholder="What did you do?"
              />
              <button
                type="button"
                onClick={() => removeEntry(e._key)}
                className="text-muted-foreground hover:text-destructive shrink-0 mt-2"
                title="Remove entry"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Minutes */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  step={15}
                  value={e.minutes}
                  onChange={(ev) => patch(e._key, { minutes: Math.max(0, parseInt(ev.target.value) || 0) })}
                  className="w-20 tabular-nums"
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>

              {/* Case picker */}
              <div className="min-w-[220px] flex-1">
                <CasePicker
                  cases={cases}
                  value={e.case_id}
                  label={e.short_name || e.case_name}
                  guess={!e.case_id ? e.raw_reference : null}
                  onChange={(c) =>
                    patch(e._key, {
                      case_id: c?.id ?? null,
                      case_name: c?.case_name ?? null,
                      short_name: c?.short_name ?? null,
                    })
                  }
                />
              </div>
            </div>

            {/* People */}
            <PeopleEditor
              people={e.people}
              onAdd={(p) =>
                !e.person_ids.includes(p.id) &&
                patch(e._key, {
                  person_ids: [...e.person_ids, p.id],
                  people: [...e.people, p],
                })
              }
              onRemove={(id) =>
                patch(e._key, {
                  person_ids: e.person_ids.filter((x) => x !== id),
                  people: e.people.filter((p) => p.id !== id),
                })
              }
            />
          </div>
        ))}

        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No entries. Discard this log or go back.
          </p>
        )}
      </div>

      {/* Footer: total + actions */}
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Day total</span>
          <span className={cn("text-sm font-semibold tabular-nums", overCeiling && "text-warning-foreground")}>
            {formatMinutes(total)}
          </span>
          {overCeiling && (
            <span className="flex items-center gap-1 text-xs text-warning-foreground">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
              over 7h
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard} className="text-muted-foreground hover:text-destructive">
            Discard
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isSaving || entries.length === 0}>
            {isSaving ? "Confirming…" : "Confirm day"}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface CaseOption {
  id: number
  case_name: string
  short_name: string | null
}

function CasePicker({
  cases,
  value,
  label,
  guess,
  onChange,
}: {
  cases: CaseOption[]
  value: number | null
  label: string | null
  guess: string | null
  onChange: (c: CaseOption | null) => void
}) {
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

function PeopleEditor({
  people,
  onAdd,
  onRemove,
}: {
  people: { id: number; name: string }[]
  onAdd: (p: { id: number; name: string }) => void
  onRemove: (id: number) => void
}) {
  // Preload the contact list once; the Combobox filters it client-side.
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
