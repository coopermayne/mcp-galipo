import { useEffect } from "react"
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

  const listIds = state?.listIds
  const listPath = state?.listPath
  const currentIndex = listIds ? listIds.indexOf(currentId) : -1
  const idx = currentIndex !== -1 ? currentIndex : state?.listIndex ?? -1
  const prevId = listIds && idx > 0 ? listIds[idx - 1] : null
  const nextId = listIds && idx < listIds.length - 1 ? listIds[idx + 1] : null

  // j/k to move to the previous/next item in the list.
  useEffect(() => {
    if (!listIds || !listPath) return
    const ids = listIds
    const path = listPath

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "j" && e.key !== "k") return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Don't hijack keys while typing in a field.
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return
      }

      if (e.key === "j" && nextId != null) {
        e.preventDefault()
        navigate(`${basePath}/${nextId}`, {
          state: { listIds: ids, listIndex: idx + 1, listPath: path } satisfies ListNavState,
          replace: true,
        })
      } else if (e.key === "k" && prevId != null) {
        e.preventDefault()
        navigate(`${basePath}/${prevId}`, {
          state: { listIds: ids, listIndex: idx - 1, listPath: path } satisfies ListNavState,
          replace: true,
        })
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [listIds, listPath, idx, prevId, nextId, basePath, navigate])

  if (!listIds || !listPath) {
    return (
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        &larr; Back
      </button>
    )
  }

  const ids = listIds
  const path = listPath

  function go(id: number, newIndex: number) {
    navigate(`${basePath}/${id}`, {
      state: { listIds: ids, listIndex: newIndex, listPath: path } satisfies ListNavState,
      replace: true,
    })
  }

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => navigate(path)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        &larr; Back to list
      </button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{idx + 1} of {ids.length}</span>
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
