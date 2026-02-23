import type { CaseProceeding } from "@/types/case"

interface CaseProceedingsProps {
  proceedings: CaseProceeding[]
}

export function CaseProceedings({ proceedings }: CaseProceedingsProps) {
  return (
    <div className="border p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Proceedings
      </h2>
      {proceedings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proceedings.</p>
      ) : (
        <div className="space-y-3">
          {proceedings.map((p) => (
            <div key={p.id} className="text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium font-mono">{p.case_number}</span>
                {p.is_primary && (
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Primary
                  </span>
                )}
              </div>
              {p.jurisdiction_name && (
                <p className="text-muted-foreground text-xs">{p.jurisdiction_name}</p>
              )}
              {p.judge_name && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Judge:</span>{" "}
                  {p.judge_name}
                </p>
              )}
              {p.notes && (
                <p className="text-xs text-muted-foreground">{p.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
