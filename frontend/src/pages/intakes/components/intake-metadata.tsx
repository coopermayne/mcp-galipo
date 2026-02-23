import type { Intake } from "@/types/intake"
import { Separator } from "@/components/ui/separator"

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

function SolBadge({ days, label }: { days: number; label: string }) {
  const color =
    days < 0
      ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
      : days <= 30
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
        : "bg-muted text-foreground"

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium tabular-nums ${color}`}>
      {label}: {days}d
    </span>
  )
}

function MetadataRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className="text-right text-xs font-medium">{value || "—"}</span>
    </div>
  )
}

interface IntakeMetadataProps {
  intake: Intake
}

export function IntakeMetadata({ intake }: IntakeMetadataProps) {
  const hasDoi = !!intake.incident_date

  return (
    <div className="border p-4">
      <h3 className="mb-3 text-sm font-semibold">Details</h3>

      <MetadataRow label="Case Type" value={intake.case_type} />
      <MetadataRow label="Location" value={intake.location} />
      <MetadataRow label="DOI" value={formatDate(intake.incident_date)} />
      {intake.incident_time && (
        <MetadataRow label="Time" value={intake.incident_time} />
      )}
      <MetadataRow label="Submitted" value={formatDate(intake.submitted_on)} />

      {hasDoi && (
        <div className="mt-2 flex gap-2">
          <SolBadge days={daysUntil(intake.incident_date!, 6)} label="6MO" />
          <SolBadge days={daysUntil(intake.incident_date!, 24)} label="2YR" />
        </div>
      )}

      <Separator className="my-3" />
      <h3 className="mb-3 text-sm font-semibold">Contact</h3>
      <MetadataRow label="Name" value={intake.name} />
      <MetadataRow label="Email" value={intake.email} />
      <MetadataRow label="Phone" value={intake.phone} />
      {intake.contact_relationship && (
        <MetadataRow label="Relationship" value={intake.contact_relationship} />
      )}

      {(intake.referral_name || intake.referral_org || intake.referral_email || intake.referral_phone) && (
        <>
          <Separator className="my-3" />
          <h3 className="mb-3 text-sm font-semibold">Referral</h3>
          {intake.referral_name && <MetadataRow label="Name" value={intake.referral_name} />}
          {intake.referral_org && <MetadataRow label="Organization" value={intake.referral_org} />}
          {intake.referral_email && <MetadataRow label="Email" value={intake.referral_email} />}
          {intake.referral_phone && <MetadataRow label="Phone" value={intake.referral_phone} />}
        </>
      )}
    </div>
  )
}
