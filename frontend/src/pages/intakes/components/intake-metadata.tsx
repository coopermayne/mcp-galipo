import type { Intake } from "@/types/intake"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
} from "@hugeicons/core-free-icons"

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function daysUntil(doi: string, months: number): number {
  const deadline = new Date(doi)
  deadline.setMonth(deadline.getMonth() + months)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function solColor(days: number): string {
  if (days < 0) return "text-red-600 dark:text-red-400"
  if (days <= 30) return "text-yellow-700 dark:text-yellow-400"
  return "text-muted-foreground"
}

interface IntakeMetadataProps {
  intake: Intake
}

export function IntakeMetadata({ intake }: IntakeMetadataProps) {
  const hasDoi = !!intake.incident_date
  const hasReferral = intake.referral_name || intake.referral_org || intake.referral_email || intake.referral_phone

  return (
    <div className="grid grid-cols-1 gap-6 border p-4 md:grid-cols-2">
      {/* Contact + Referral */}
      <div>
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Contact</h3>
        <div className="flex flex-col gap-1.5">
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
              <span className="text-xs">{intake.phone}</span>
            </div>
          )}
          {intake.contact_relationship && (
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Link01Icon} className="size-3.5 text-muted-foreground" />
              <span className="text-xs">{intake.contact_relationship}</span>
            </div>
          )}
        </div>

        {hasReferral && (
          <div className="mt-4">
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Referral</h3>
            <div className="flex flex-col gap-1.5">
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
                  <span className="text-xs">{intake.referral_phone}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Incident */}
      <div>
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Incident</h3>
        <div className="flex flex-col gap-1.5">
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
                    <p>{six} days to 6-month SOL · {two} days to 2-year SOL</p>
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
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Submitted</h3>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 text-muted-foreground" />
            <span className="text-xs">{formatDate(intake.submitted_on)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
