import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Intake } from "@/types/intake"
import { formatPhone } from "@/lib/utils"
import { updateIntake } from "@/services/intakes"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SmsLaunchButton } from "@/components/common/sms-launch-button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatTimestampRaw } from "@/lib/datetime"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserIcon,
  Mail01Icon,
  CallIcon,
  Tag01Icon,
  Calendar03Icon,
  Location01Icon,
  Building01Icon,
  Link01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"

/** Parse a date-only string (YYYY-MM-DD) as local midnight, not UTC. */
function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(dateStr)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return parseLocalDate(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function daysUntil(doi: string, months: number): number {
  const deadline = parseLocalDate(doi)
  deadline.setMonth(deadline.getMonth() + months)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function solColor(days: number): string {
  if (days < 0) return "text-destructive"
  if (days <= 30) return "text-warning-foreground"
  return "text-muted-foreground"
}

const EDITABLE_FIELDS = [
  "name", "email", "phone", "contact_relationship",
  "referral_name", "referral_org", "referral_email", "referral_phone",
  "case_type", "incident_date", "incident_time", "location",
] as const

type EditableField = typeof EDITABLE_FIELDS[number]
type Draft = Record<EditableField, string>

function makeDraft(intake: Intake): Draft {
  const draft = {} as Draft
  for (const field of EDITABLE_FIELDS) {
    draft[field] = intake[field] ?? ""
  }
  return draft
}

interface IntakeMetadataProps {
  intake: Intake
}

export function IntakeMetadata({ intake }: IntakeMetadataProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => makeDraft(intake))

  const hasDoi = !!intake.incident_date
  const hasReferral = intake.referral_name || intake.referral_org || intake.referral_email || intake.referral_phone

  const mutation = useMutation({
    mutationFn: (changes: Partial<Intake>) => updateIntake(intake.id, changes),
    onSuccess: (data) => {
      queryClient.setQueryData(["intake", intake.id], data.intake)
      queryClient.invalidateQueries({ queryKey: ["intakes"] })
      toast.success("Intake updated")
      setIsEditing(false)
    },
    onError: () => {
      toast.error("Failed to update intake")
    },
  })

  const handleEdit = () => {
    setDraft(makeDraft(intake))
    setIsEditing(true)
  }

  const handleCancel = () => {
    setDraft(makeDraft(intake))
    setIsEditing(false)
  }

  const handleSave = () => {
    // Only send changed fields
    const changes: Record<string, string | null> = {}
    for (const field of EDITABLE_FIELDS) {
      const original = intake[field] ?? ""
      const edited = draft[field].trim()
      if (edited !== original) {
        changes[field] = edited || null
      }
    }
    if (Object.keys(changes).length === 0) {
      setIsEditing(false)
      return
    }
    mutation.mutate(changes as Partial<Intake>)
  }

  const updateField = (field: EditableField, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  // Shared input props for consistent styling
  const inputProps = (field: EditableField) => ({
    value: draft[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => updateField(field, e.target.value),
    className: "h-6 text-xs px-1.5",
  })

  return (
    <div className="border">
      {/* Header row with edit toggle */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Details</h2>
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={handleCancel}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              Save
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={handleEdit}
          >
            <HugeiconsIcon icon={PencilEdit01Icon} className="size-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
        {/* Contact + Referral */}
        <div>
          <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Contact</h3>
          <div className="flex flex-col gap-1.5">
            {isEditing ? (
              <>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={UserIcon} className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input placeholder="Name" {...inputProps("name")} />
                </div>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Mail01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input placeholder="Email" type="email" {...inputProps("email")} />
                </div>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={CallIcon} className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input placeholder="Phone" type="tel" {...inputProps("phone")} />
                </div>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Link01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input placeholder="Relationship" {...inputProps("contact_relationship")} />
                </div>
              </>
            ) : (
              <>
                {intake.name && (
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={UserIcon} className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{intake.name}</span>
                  </div>
                )}
                {intake.email && (
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Mail01Icon} className="size-3.5 text-muted-foreground" />
                    <span className="text-xs">{intake.email}</span>
                  </div>
                )}
                {intake.phone && (
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={CallIcon} className="size-3.5 text-muted-foreground" />
                    <span className="text-xs">{formatPhone(intake.phone)}</span>
                    <SmsLaunchButton
                      phone={intake.phone}
                      label={intake.name ?? undefined}
                    />
                  </div>
                )}
                {intake.contact_relationship && (
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Link01Icon} className="size-3.5 text-muted-foreground" />
                    <span className="text-xs">{intake.contact_relationship}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {isEditing || hasReferral ? (
            <div className="mt-4">
              <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Referral</h3>
              <div className="flex flex-col gap-1.5">
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={UserIcon} className="size-3.5 shrink-0 text-muted-foreground" />
                      <Input placeholder="Name" {...inputProps("referral_name")} />
                    </div>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={Building01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                      <Input placeholder="Organization" {...inputProps("referral_org")} />
                    </div>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={Mail01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                      <Input placeholder="Email" type="email" {...inputProps("referral_email")} />
                    </div>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={CallIcon} className="size-3.5 shrink-0 text-muted-foreground" />
                      <Input placeholder="Phone" type="tel" {...inputProps("referral_phone")} />
                    </div>
                  </>
                ) : (
                  <>
                    {intake.referral_name && (
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={UserIcon} className="size-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{intake.referral_name}</span>
                      </div>
                    )}
                    {intake.referral_org && (
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Building01Icon} className="size-3.5 text-muted-foreground" />
                        <span className="text-xs">{intake.referral_org}</span>
                      </div>
                    )}
                    {intake.referral_email && (
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Mail01Icon} className="size-3.5 text-muted-foreground" />
                        <span className="text-xs">{intake.referral_email}</span>
                      </div>
                    )}
                    {intake.referral_phone && (
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={CallIcon} className="size-3.5 text-muted-foreground" />
                        <span className="text-xs">{formatPhone(intake.referral_phone)}</span>
                        <SmsLaunchButton
                          phone={intake.referral_phone}
                          label={
                            intake.referral_name
                              ? `${intake.referral_name} (referral)`
                              : intake.referral_org
                                ? `${intake.referral_org} (referral)`
                                : undefined
                          }
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Incident */}
        <div>
          <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Incident</h3>
          <div className="flex flex-col gap-1.5">
            {isEditing ? (
              <>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Tag01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input placeholder="Case type" {...inputProps("case_type")} />
                </div>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input type="date" {...inputProps("incident_date")} />
                  <Input placeholder="Time" {...inputProps("incident_time")} className="h-6 w-20 text-xs px-1.5" />
                </div>
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Location01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                  <Input placeholder="Location" {...inputProps("location")} />
                </div>
              </>
            ) : (
              <>
                {intake.case_type && (
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Tag01Icon} className="size-3.5 text-muted-foreground" />
                    <span className="text-xs">{intake.case_type}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{formatDate(intake.incident_date)}</span>
                  {intake.incident_time && (
                    <span className="text-xs text-muted-foreground">at {intake.incident_time}</span>
                  )}
                  {hasDoi && (() => {
                    const six = daysUntil(intake.incident_date!, 6)
                    const two = daysUntil(intake.incident_date!, 24)
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1 cursor-default text-[10px] tabular-nums">
                            <span className="text-muted-foreground/40">(</span>
                            <span className={solColor(six)}>{six}</span>
                            <span className="text-muted-foreground/40"> / </span>
                            <span className={solColor(two)}>{two}</span>
                            <span className="text-muted-foreground/40">)</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{six} days to 6-month SOL</p>
                          <p>{two} days to 2-year SOL</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })()}
                </div>
                {intake.location && (
                  <div className="flex items-start gap-2">
                    <HugeiconsIcon icon={Location01Icon} className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {intake.location_short && intake.location_short !== intake.location ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default text-xs">{intake.location_short}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{intake.location}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs">{intake.location_short ?? intake.location}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Submitted</h3>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 text-muted-foreground" />
              <span className="text-xs">{formatTimestampRaw(intake.submitted_on)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
