import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { summarizeInteraction, saveInteraction } from "@/services/intakes"
import { markIntakeRead } from "@/services/intakes"

interface AddInteractionDialogProps {
  intakeId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddInteractionDialog({
  intakeId,
  open,
  onOpenChange,
}: AddInteractionDialogProps) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<"email" | "phone">("email")
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound")
  const [content, setContent] = useState("")

  // Phase 2 state
  const [phase, setPhase] = useState<"input" | "review">("input")
  const [summary, setSummary] = useState("")

  const summarizeMutation = useMutation({
    mutationFn: () =>
      summarizeInteraction(intakeId, {
        interaction_type: type,
        direction,
        content: content.trim(),
      }),
    onSuccess: (data) => {
      setSummary(data.summary)
      setPhase("review")
    },
    onError: () => {
      toast.error("Failed to generate summary")
    },
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      saveInteraction(intakeId, {
        interaction_type: type,
        direction,
        content: content.trim(),
        summary: summary.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake-comments", intakeId] })
      markIntakeRead(intakeId).catch(() => {})
      onOpenChange(false)
      toast.success("Interaction logged")
    },
    onError: () => {
      toast.error("Failed to save interaction")
    },
  })

  function handleOpenChange(next: boolean) {
    if (next) {
      setType("email")
      setDirection("inbound")
      setContent("")
      setSummary("")
      setPhase("input")
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
        </DialogHeader>

        {phase === "input" ? (
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="mb-1.5 block text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as "email" | "phone")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <Label className="mb-1.5 block text-xs">Direction</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as "inbound" | "outbound")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">
                {type === "email" ? "Paste email text" : "Call notes"}
              </Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  type === "email"
                    ? "Paste the email content here..."
                    : "Type your call notes here..."
                }
                className="min-h-[160px] resize-none"
              />
            </div>

            <Button
              onClick={() => summarizeMutation.mutate()}
              disabled={!content.trim() || summarizeMutation.isPending}
              className="w-full"
            >
              {summarizeMutation.isPending ? "Summarizing..." : "Summarize"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <Label className="mb-1.5 block text-xs">Summary (edit if needed)</Label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPhase("input")}
                className="flex-1"
                disabled={saveMutation.isPending}
              >
                Back
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!summary.trim() || saveMutation.isPending}
                className="flex-1"
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
