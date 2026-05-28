import { useState, useMemo, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams, Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, MoreHorizontalIcon, UserMultipleIcon, UserAccountIcon, ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDebounce } from "@/hooks/use-debounce"
import { searchContacts } from "@/services/contacts"
import { searchPersons } from "@/services/persons"
import { SearchResultItem } from "@/pages/contacts/components/search-result-item"
import { ContactsListView } from "@/pages/contacts/components/contacts-list-view"
import { ContactDetailDialog } from "@/components/common/contact-detail-dialog"
import { JudgeDetailDialog } from "@/pages/judges/components/judge-detail-dialog"
import { MergeContactsDialog } from "@/pages/contacts/components/merge-contacts-dialog"
import type { JudgeListItem } from "@/services/judges"
import type { PersonListItem } from "@/types/person"
import type { UnifiedSearchResult } from "@/services/contacts"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { value: undefined, label: "All", urlSegment: undefined },
  { value: "client", label: "Clients", urlSegment: "clients" },
  { value: "counsel", label: "Counsel", urlSegment: "counsel" },
  { value: "expert", label: "Experts", urlSegment: "experts" },
  { value: "defendant", label: "Defendants", urlSegment: "defendants" },
  { value: "mediator", label: "Mediators", urlSegment: "mediators" },
  { value: "other", label: "Other", urlSegment: "other" },
  { value: "judge", label: "Judges", urlSegment: "judges" },
] as const

function categoryFromSegment(segment: string | undefined): string | undefined {
  if (!segment) return undefined
  return CATEGORIES.find((c) => c.urlSegment === segment)?.value
}

export default function ContactsPage() {
  const { "*": splat } = useParams()
  const segment = splat?.split("/")[0] || undefined
  const activeCategory = categoryFromSegment(segment)

  const [query, setQuery] = useState("")
  const debouncedQuery = useDebounce(query, 250)
  const isSearching = debouncedQuery.length >= 2

  const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null)
  const [selectedJudge, setSelectedJudge] = useState<JudgeListItem | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [page, setPage] = useState(0)
  const pageSize = 50

  // Unified search (when typing)
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["contacts", "search", debouncedQuery],
    queryFn: () => searchContacts(debouncedQuery),
    enabled: isSearching,
  })

  // Category browsing (when not searching)
  const { data: browseData, isLoading: browseLoading } = useQuery({
    queryKey: ["persons", activeCategory, page],
    queryFn: () =>
      searchPersons({
        category: activeCategory === "judge" ? undefined : activeCategory,
        limit: pageSize,
        offset: page * pageSize,
        include_roles: true,
      }),
    enabled: !isSearching && !!activeCategory && activeCategory !== "judge",
  })

  const browseTotal = browseData?.total ?? 0
  const totalPages = Math.ceil(browseTotal / pageSize)

  // Judges browsing
  const { data: judgesData, isLoading: judgesLoading } = useQuery({
    queryKey: ["judges-browse"],
    queryFn: async () => {
      const { getJudges } = await import("@/services/judges")
      return getJudges()
    },
    enabled: !isSearching && activeCategory === "judge",
  })

  const browsePersons = useMemo(() => {
    return (browseData?.persons ?? []).filter((p) => !p.archived)
  }, [browseData])

  const searchResults = searchData?.results ?? []

  function handleSearchResultClick(result: UnifiedSearchResult) {
    if (result.type === "person") {
      setSelectedPerson({
        id: result.id,
        name: result.name,
        phones: result.phones,
        emails: result.emails,
        organization: result.organization,
        notes: null,
        archived: null,
        created_at: null,
      })
    } else {
      setSelectedJudge({
        id: result.id,
        name: result.name,
        phones: result.phones,
        emails: result.emails,
        title: result.title,
        jurisdiction_id: null,
        jurisdiction_name: result.jurisdiction,
        chambers: null,
        courtroom_number: result.courtroom,
        appointed_by: null,
        appointed_date: null,
        initials: null,
        status: null,
        notes: null,
      })
    }
  }

  useEffect(() => { setPage(0) }, [activeCategory])

  const pageTitle = activeCategory
    ? CATEGORIES.find((c) => c.value === activeCategory)?.label ?? "Contacts"
    : "Contacts"

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-muted-foreground text-sm">
          Search for people and judges across your cases.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, email, or firm..."
            className="h-10 pl-9 text-sm"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 border border-border">
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setMergeOpen(true)}>
              <HugeiconsIcon icon={UserMultipleIcon} className="mr-2 size-4" />
              Find Duplicates
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/people-types">
                <HugeiconsIcon icon={UserAccountIcon} className="mr-2 size-4" />
                Manage People Types
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Category tabs (only when not searching) */}
      {!isSearching && (
        <div className="flex flex-wrap items-center gap-1">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.label}
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                "h-7 px-2.5 text-xs border",
                activeCategory === cat.value
                  ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                  : "text-muted-foreground"
              )}
            >
              <a href={cat.urlSegment ? `/contacts/${cat.urlSegment}` : "/contacts"}>
                {cat.label}
              </a>
            </Button>
          ))}
        </div>
      )}

      {/* Search results mode */}
      {isSearching ? (
        searchLoading ? (
          <div className="border border-border divide-y divide-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-8 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/3" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : searchResults.length > 0 ? (
          <div className="border border-border">
            {searchResults.map((result) => (
              <SearchResultItem
                key={`${result.type}-${result.id}`}
                result={result}
                onClick={handleSearchResultClick}
              />
            ))}
            {searchData && searchData.total > searchResults.length && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border/50">
                Showing {searchResults.length} of {searchData.total} results
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">No results found for &ldquo;{debouncedQuery}&rdquo;</p>
          </div>
        )
      ) : activeCategory === "judge" ? (
        // Judge browsing mode
        <div className="border border-border">
          {judgesLoading ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="size-8 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (judgesData?.judges ?? []).length > 0 ? (
            (judgesData?.judges ?? []).map((judge) => (
              <SearchResultItem
                key={`judge-${judge.id}`}
                result={{
                  type: "judge",
                  id: judge.id,
                  name: judge.name,
                  phones: judge.phones,
                  emails: judge.emails,
                  jurisdiction: judge.jurisdiction_name,
                  title: judge.title,
                  courtroom: judge.courtroom_number,
                  score: 0,
                }}
                onClick={handleSearchResultClick}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              No judges found.
            </div>
          )}
        </div>
      ) : !activeCategory ? (
        // "All" — prompt to search instead of listing everyone
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <HugeiconsIcon icon={Search01Icon} className="size-8 mb-3 opacity-50" />
          <p className="text-sm">Search for a contact, or pick a category to browse.</p>
        </div>
      ) : (
        // Person browsing mode (specific category)
        <>
          <ContactsListView
            persons={browsePersons}
            isLoading={browseLoading}
            groupByCategory={false}
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-muted-foreground">
                {page * pageSize + 1}&ndash;{Math.min((page + 1) * pageSize, browseTotal)} of {browseTotal}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                >
                  <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ContactDetailDialog
        person={selectedPerson}
        open={!!selectedPerson}
        onOpenChange={(open) => {
          if (!open) setSelectedPerson(null)
        }}
      />

      <JudgeDetailDialog
        judge={selectedJudge}
        open={!!selectedJudge}
        onOpenChange={(open) => {
          if (!open) setSelectedJudge(null)
        }}
      />

      <MergeContactsDialog open={mergeOpen} onOpenChange={setMergeOpen} />
    </div>
  )
}
