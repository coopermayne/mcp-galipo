import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { getDaleCase, getDaleComments } from "@/services/dale"
import { formatTimestamp } from "@/lib/datetime"
import { VoiceCommentButton } from "./components/voice-comment-button"

export default function DaleCaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const id = Number(caseId)

  const { data: kase, isLoading } = useQuery({
    queryKey: ["dale", "case", id],
    queryFn: () => getDaleCase(id),
    enabled: !!id,
  })

  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ["dale", "comments", "case", id],
    queryFn: () => getDaleComments("case", id),
    enabled: !!id,
  })

  if (isLoading || !kase) {
    return (
      <div className="px-4 pt-6">
        <BackLink />
        <p className="mt-6 text-base text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const trialDate = kase.trial_date
    ? formatLongDate(kase.trial_date)
    : null
  const doi = kase.date_of_injury ? formatLongDate(kase.date_of_injury) : null

  return (
    <div className="px-4 pt-6">
      <BackLink />
      <h1 className="mt-3 text-2xl font-semibold leading-tight">
        {kase.short_name || kase.case_name}
      </h1>
      <p className="mt-1 text-base text-muted-foreground">{kase.status}</p>

      <dl className="mt-6 space-y-4">
        {trialDate && (
          <FactRow label="Trial date" value={trialDate} />
        )}
        {doi && <FactRow label="Date of injury" value={doi} />}
        {kase.attorneys && kase.attorneys.length > 0 && (
          <FactRow
            label="Attorneys"
            value={kase.attorneys.map((a) => `${a.first_name} ${a.last_name}`).join(", ")}
          />
        )}
        {kase.paralegals && kase.paralegals.length > 0 && (
          <FactRow
            label="Paralegals"
            value={kase.paralegals.map((p) => `${p.first_name} ${p.last_name}`).join(", ")}
          />
        )}
      </dl>

      {kase.case_summary && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Summary</h2>
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {kase.case_summary}
          </p>
        </section>
      )}

      {kase.events && kase.events.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Upcoming</h2>
          <ul className="space-y-3">
            {kase.events
              .filter((e) => !e.date || e.date >= today())
              .slice(0, 8)
              .map((e) => (
                <li key={e.id} className="border-l-2 border-muted pl-3">
                  <p className="text-base font-medium">{e.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {e.date ? formatLongDate(e.date) : "—"}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </li>
              ))}
          </ul>
        </section>
      )}

      {commentsData && commentsData.comments.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Notes</h2>
          <ul className="space-y-4">
            {commentsData.comments.map((c) => (
              <li key={c.id} className="border-l-2 border-muted pl-3">
                <p className="whitespace-pre-wrap text-base">{c.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.user_initials || "—"} · {formatTimestamp(c.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <VoiceCommentButton
        entityType="case"
        entityId={id}
        contextLabel={kase.short_name || kase.case_name}
        onSaved={() => refetchComments()}
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/dale"
      className="inline-flex h-12 items-center gap-2 text-base text-muted-foreground active:text-foreground"
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} size={22} />
      Cases
    </Link>
  )
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-base">{value}</dd>
    </div>
  )
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
