import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDebounce } from "@/hooks/use-debounce"
import { searchPayees, createPayee } from "@/services/payees"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon, Cancel01Icon } from "@hugeicons/core-free-icons"

interface PayeeSearchProps {
  value: number | null
  valueName?: string | null
  onChange: (payeeId: number | null) => void
  extractedName?: string
  extractedAddress?: string
}

export function PayeeSearch({
  value,
  valueName,
  onChange,
  extractedName,
  extractedAddress,
}: PayeeSearchProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedName, setSelectedName] = useState<string | null>(valueName ?? null)
  const [mode, setMode] = useState<"search" | "create">(value ? "search" : "search")
  const [newName, setNewName] = useState("")
  const [newAddress, setNewAddress] = useState("")

  const debouncedSearch = useDebounce(search, 300)

  // Search payees
  const { data: results } = useQuery({
    queryKey: ["payee-search", debouncedSearch],
    queryFn: () => searchPayees(debouncedSearch, 10),
    enabled: debouncedSearch.length >= 1 && !value,
  })

  useEffect(() => {
    if (valueName) setSelectedName(valueName)
  }, [valueName])

  useEffect(() => {
    if (extractedName && !value && !search) {
      setSearch(extractedName)
    }
  }, [extractedName])

  // Create payee mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; address?: string }) => createPayee(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payee-search"] })
      setSelectedName(result.payee.name)
      onChange(result.payee.id)
      setMode("search")
      setNewName("")
      setNewAddress("")
    },
  })

  function handleSelect(payee: { id: number; name: string }) {
    setSelectedName(payee.name)
    onChange(payee.id)
    setSearch("")
  }

  function handleClear() {
    setSelectedName(null)
    onChange(null)
    setSearch("")
  }

  function handleCreate() {
    if (!newName.trim()) return
    createMutation.mutate({
      name: newName.trim(),
      address: newAddress.trim() || undefined,
    })
  }

  function handleFillFromExtracted() {
    if (extractedName) setNewName(extractedName)
    if (extractedAddress) setNewAddress(extractedAddress)
  }

  // Selected state: show the payee name with a clear button
  if (value && selectedName) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">Payee</Label>
        <div className="flex items-center gap-2 border px-3 py-2">
          <span className="text-sm font-medium flex-1 truncate">
            {selectedName}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // Create mode: inline form
  if (mode === "create") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">New Payee</Label>
          {(extractedName || extractedAddress) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={handleFillFromExtracted}
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-3" />
              Fill from invoice
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Payee name"
            autoFocus
          />
          <Textarea
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="Address (optional)"
            rows={2}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={handleCreate}
          >
            {createMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setMode("search")
              setNewName("")
              setNewAddress("")
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Search mode: input + results + create link
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Payee</Label>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search payees..."
      />

      {/* Results list */}
      {results && results.length > 0 && (
        <div className="max-h-32 overflow-y-auto border divide-y">
          {results.map((payee) => (
            <button
              key={payee.id}
              type="button"
              onClick={() => handleSelect(payee)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
            >
              <span className="font-medium">{payee.name}</span>
              {payee.address && (
                <span className="text-muted-foreground truncate max-w-[160px] ml-2">
                  {payee.address.split("\n")[0]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {debouncedSearch.length >= 1 && results && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No payees found.</p>
      )}

      <button
        type="button"
        onClick={() => {
          setMode("create")
          setNewName(search)
        }}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        + Create new payee
      </button>
    </div>
  )
}
