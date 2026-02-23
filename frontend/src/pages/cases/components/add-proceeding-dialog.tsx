import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import { createProceeding, assignJudgeToProceeding } from "@/services/proceedings"
import { getJurisdictions } from "@/services/jurisdictions"
import { searchJudges } from "@/services/judges"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AddProceedingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: number
}

export function AddProceedingDialog({
  open,
  onOpenChange,
  caseId,
}: AddProceedingDialogProps) {
  const queryClient = useQueryClient()
  const [caseNumber, setCaseNumber] = useState("")
  const [jurisdictionId, setJurisdictionId] = useState<string>("")
  const [isPrimary, setIsPrimary] = useState(false)
  const [notes, setNotes] = useState("")
  const [judgeSearch, setJudgeSearch] = useState("")
  const [selectedJudgeId, setSelectedJudgeId] = useState<number | null>(null)

  const debouncedJudgeSearch = useDebounce(judgeSearch, 300)

  const { data: jurisdictionsData } = useQuery({
    queryKey: ["jurisdictions"],
    queryFn: getJurisdictions,
    enabled: open,
  })

  const { data: judgesData } = useQuery({
    queryKey: ["judges-search", debouncedJudgeSearch, jurisdictionId],
    queryFn: () =>
      searchJudges(
        debouncedJudgeSearch,
        jurisdictionId ? Number(jurisdictionId) : undefined
      ),
    enabled: open && debouncedJudgeSearch.length >= 2,
  })

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setCaseNumber("")
      setJurisdictionId("")
      setIsPrimary(false)
      setNotes("")
      setJudgeSearch("")
      setSelectedJudgeId(null)
    }
  }, [open])

  const jurisdictions = jurisdictionsData?.jurisdictions ?? []
  const judges = judgesData?.judges ?? []

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await createProceeding(caseId, {
        case_number: caseNumber,
        jurisdiction_id: jurisdictionId ? Number(jurisdictionId) : undefined,
        is_primary: isPrimary,
        notes: notes || undefined,
      })
      // If a judge was selected, assign them
      if (selectedJudgeId && result.proceeding?.id) {
        await assignJudgeToProceeding(result.proceeding.id, {
          judge_id: selectedJudgeId,
        })
      }
    },
    onSuccess: () => {
      toast.success("Proceeding created")
      queryClient.invalidateQueries({ queryKey: ["case", caseId] })
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Proceeding</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Case Number</Label>
            <Input
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="e.g. 2024-CV-12345"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Jurisdiction</Label>
            <Select value={jurisdictionId} onValueChange={setJurisdictionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select jurisdiction..." />
              </SelectTrigger>
              <SelectContent>
                {jurisdictions.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Judge search */}
          <div className="space-y-1.5">
            <Label className="text-xs">Judge</Label>
            <Input
              value={judgeSearch}
              onChange={(e) => {
                setJudgeSearch(e.target.value)
                setSelectedJudgeId(null)
              }}
              placeholder="Search for a judge..."
            />
            {judges.length > 0 && !selectedJudgeId && (
              <div className="max-h-32 overflow-y-auto border divide-y">
                {judges.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => {
                      setSelectedJudgeId(j.id)
                      setJudgeSearch(j.name)
                    }}
                    className="flex items-center w-full px-3 py-2 text-xs hover:bg-accent transition-colors"
                  >
                    {j.title ? `${j.title} ` : ""}
                    {j.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_primary"
              checked={isPrimary}
              onCheckedChange={(v) => setIsPrimary(v === true)}
            />
            <Label htmlFor="is_primary" className="text-xs cursor-pointer">
              Primary proceeding
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!caseNumber.trim() || mutation.isPending}
            size="sm"
          >
            {mutation.isPending ? "Creating..." : "Create Proceeding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
