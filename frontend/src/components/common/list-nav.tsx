import { useLocation, useNavigate } from "react-router"

export interface ListNavState {
  listIds: number[]
  listIndex: number
  listPath: string
}

interface ListNavProps {
  /** Base path for items, e.g. "/cases" or "/intakes" */
  basePath: string
  /** Current item ID */
  currentId: number
}

export function ListNav({ basePath, currentId }: ListNavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as ListNavState | null

  if (!state?.listIds) {
    return (
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        &larr; Back
      </button>
    )
  }

  const { listIds, listPath } = state
  const currentIndex = listIds.indexOf(currentId)
  const idx = currentIndex !== -1 ? currentIndex : state.listIndex
  const prevId = idx > 0 ? listIds[idx - 1] : null
  const nextId = idx < listIds.length - 1 ? listIds[idx + 1] : null

  function go(id: number, newIndex: number) {
    navigate(`${basePath}/${id}`, {
      state: { listIds, listIndex: newIndex, listPath } satisfies ListNavState,
      replace: true,
    })
  }

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => navigate(listPath)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        &larr; Back to list
      </button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{idx + 1} of {listIds.length}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => prevId != null && go(prevId, idx - 1)}
            disabled={prevId == null}
            className="hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            &larr; Prev
          </button>
          <span className="text-muted-foreground/40">|</span>
          <button
            onClick={() => nextId != null && go(nextId, idx + 1)}
            disabled={nextId == null}
            className="hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
