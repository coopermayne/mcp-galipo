import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { useQuickCreate } from "@/hooks/use-quick-create"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Briefcase01Icon,
  UserMultipleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { CaseStatusBadge } from "@/pages/cases/components/status-badge"
import type { CaseStatus } from "@/types/case"
import { searchCases, type CaseSearchResult } from "@/services/cases"
import {
  searchContacts,
  type UnifiedSearchResult,
} from "@/services/contacts"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"

type SearchItem =
  | { type: "case"; data: CaseSearchResult }
  | { type: "contact"; data: UnifiedSearchResult }

interface QuickCaseSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickCaseSearch({ open, onOpenChange }: QuickCaseSearchProps) {
  const navigate = useNavigate()
  const { openQuickCreate } = useQuickCreate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState("")
  const [myCases, setMyCases] = useState(true)
  const [includeClosed, setIncludeClosed] = useState(false)
  const [casesCollapsed, setCasesCollapsed] = useState(false)
  const [contactsCollapsed, setContactsCollapsed] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const debouncedQuery = useDebounce(query, 200)

  // Cases search
  const { data: casesData, isFetching: casesFetching } = useQuery({
    queryKey: ["global-search", "cases", debouncedQuery, myCases, includeClosed],
    queryFn: () =>
      searchCases({
        q: debouncedQuery,
        my_cases: myCases,
        include_closed: includeClosed,
        limit: 15,
      }),
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 10_000,
  })

  // Contacts search
  const { data: contactsData, isFetching: contactsFetching } = useQuery({
    queryKey: ["global-search", "contacts", debouncedQuery],
    queryFn: () => searchContacts(debouncedQuery, 10),
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 10_000,
  })

  const cases = useMemo(() => casesData?.cases ?? [], [casesData])
  const contacts = useMemo(() => contactsData?.results ?? [], [contactsData])
  const isLoading = casesFetching || contactsFetching

  // Build a flat list of selectable items for keyboard nav
  const items = useMemo<SearchItem[]>(() => {
    const result: SearchItem[] = []
    if (!casesCollapsed) {
      for (const c of cases) {
        result.push({ type: "case", data: c })
      }
    }
    if (!contactsCollapsed) {
      for (const c of contacts) {
        result.push({ type: "contact", data: c })
      }
    }
    return result
  }, [cases, contacts, casesCollapsed, contactsCollapsed])

  // Clamp selected index when items change
  const clampedIndex = selectedIndex >= items.length
    ? Math.max(0, items.length - 1)
    : selectedIndex

  const handleSelect = useCallback(
    (item: SearchItem) => {
      onOpenChange(false)
      if (item.type === "case") {
        // Quick search opens the full case detail page (not the preview modal).
        navigate(`/cases/${item.data.id}`)
      } else {
        // Navigate to contacts page with the appropriate category
        if (item.data.type === "judge") {
          navigate("/contacts/judges")
        } else {
          navigate("/contacts")
        }
      }
    },
    [navigate, onOpenChange]
  )

  // ⌃T (Mac) / Alt+T → new Task; ⌃E / Alt+E → new Event, for the highlighted
  // case. Uses Ctrl on Mac / Alt elsewhere to dodge reserved browser shortcuts
  // (⌘T = new tab), matching the ⌃G search toggle.
  const handleQuickCreate = useCallback(
    (item: SearchItem | undefined, kind: "task" | "event") => {
      if (!item || item.type !== "case") return
      onOpenChange(false)
      openQuickCreate(kind, item.data.id, item.data.case_name)
    },
    [openQuickCreate, onOpenChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
      const createMod = isMac ? e.ctrlKey : e.altKey
      const key = e.key.toLowerCase()

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (createMod && (key === "t" || key === "e")) {
        e.preventDefault()
        handleQuickCreate(items[clampedIndex], key === "t" ? "task" : "event")
      } else if (e.key === "Enter") {
        e.preventDefault()
        const item = items[clampedIndex]
        if (item) handleSelect(item)
      }
    },
    [items, clampedIndex, handleSelect, handleQuickCreate]
  )

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Reset state on close
      setQuery("")
      setSelectedIndex(0)
      setCasesCollapsed(false)
      setContactsCollapsed(false)
    } else {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Global Search</DialogTitle>
        <DialogDescription>
          Search across cases and contacts
        </DialogDescription>
      </DialogHeader>
      <DialogContent
        className="top-1/3 translate-y-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="text-muted-foreground size-4 shrink-0"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search cases and contacts..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {isLoading && (
            <span className="text-muted-foreground shrink-0 text-[10px]">
              ...
            </span>
          )}
        </div>

        {/* Filter toggles */}
        <div className="flex items-center gap-1.5 border-b px-3 py-1.5">
          <button
            type="button"
            onClick={() => setMyCases(true)}
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium transition-colors",
              myCases
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            My Cases
          </button>
          <button
            type="button"
            onClick={() => setMyCases(false)}
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium transition-colors",
              !myCases
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            All Cases
          </button>
          <div className="bg-border mx-1 h-3 w-px" />
          <button
            type="button"
            onClick={() => setIncludeClosed((v) => !v)}
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium transition-colors",
              includeClosed
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Include Closed
          </button>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {debouncedQuery.length < 2 ? (
            <div className="text-muted-foreground py-8 text-center text-xs">
              Type at least 2 characters to search
            </div>
          ) : items.length === 0 && !isLoading ? (
            <div className="text-muted-foreground py-8 text-center text-xs">
              No results found
            </div>
          ) : (
            <>
              {/* Cases section */}
              {cases.length > 0 && (
                <SearchSection
                  icon={Briefcase01Icon}
                  label="Cases"
                  count={cases.length}
                  collapsed={casesCollapsed}
                  onToggle={() => setCasesCollapsed((v) => !v)}
                >
                  {cases.map((c) => {
                    const idx = items.findIndex(
                      (item) => item.type === "case" && item.data.id === c.id
                    )
                    return (
                      <SearchResultItem
                        key={`case-${c.id}`}
                        selected={idx === clampedIndex}
                        onSelect={() =>
                          handleSelect({ type: "case", data: c })
                        }
                        onHover={() => setSelectedIndex(idx)}
                      >
                        <div className="flex flex-1 items-center justify-between gap-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">
                              {c.case_name}
                            </span>
                            {c.short_name && (
                              <span className="text-muted-foreground text-[11px]">
                                {c.short_name}
                              </span>
                            )}
                          </div>
                          <CaseStatusBadge status={c.status as CaseStatus} />
                        </div>
                      </SearchResultItem>
                    )
                  })}
                </SearchSection>
              )}

              {/* Contacts section */}
              {contacts.length > 0 && (
                <SearchSection
                  icon={UserMultipleIcon}
                  label="Contacts"
                  count={contacts.length}
                  collapsed={contactsCollapsed}
                  onToggle={() => setContactsCollapsed((v) => !v)}
                >
                  {contacts.map((c) => {
                    const idx = items.findIndex(
                      (item) =>
                        item.type === "contact" &&
                        item.data.id === c.id &&
                        item.data.type === c.type
                    )
                    return (
                      <SearchResultItem
                        key={`${c.type}-${c.id}`}
                        selected={idx === clampedIndex}
                        onSelect={() =>
                          handleSelect({ type: "contact", data: c })
                        }
                        onHover={() => setSelectedIndex(idx)}
                      >
                        <div className="flex flex-1 items-center justify-between gap-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium">
                              {c.name}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              {c.type === "judge"
                                ? c.title || "Judge"
                                : c.role_summary || c.organization || ""}
                            </span>
                          </div>
                          <span className="text-muted-foreground shrink-0 text-[10px] uppercase">
                            {c.type}
                          </span>
                        </div>
                      </SearchResultItem>
                    )
                  })}
                </SearchSection>
              )}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
          <kbd className="bg-muted px-1 py-0.5">↑↓</kbd> navigate
          {" · "}
          <kbd className="bg-muted px-1 py-0.5">Enter</kbd> open
          {" · "}
          <kbd className="bg-muted px-1 py-0.5">⌃T</kbd> new task
          {" · "}
          <kbd className="bg-muted px-1 py-0.5">⌃E</kbd> new event
          {" · "}
          <kbd className="bg-muted px-1 py-0.5">Esc</kbd> close
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Sub-components ---

function SearchSection({
  icon,
  label,
  count,
  collapsed,
  onToggle,
  children,
}: {
  icon: unknown
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <HugeiconsIcon
          icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon}
          strokeWidth={2}
          className="size-3"
        />
        <HugeiconsIcon
          icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
          strokeWidth={2}
          className="size-3.5"
        />
        <span>{label}</span>
        <span className="text-muted-foreground/60 ml-auto">{count}</span>
      </button>
      {!collapsed && <div>{children}</div>}
    </div>
  )
}

function SearchResultItem({
  selected,
  onSelect,
  onHover,
  children,
}: {
  selected: boolean
  onSelect: () => void
  onHover: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ block: "nearest" })
    }
  }, [selected])

  return (
    <div
      ref={ref}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors",
        selected ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/50"
      )}
    >
      {children}
    </div>
  )
}
