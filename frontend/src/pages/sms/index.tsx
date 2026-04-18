import { useState, useCallback, useMemo } from "react"
import { useSearchParams, useNavigate } from "react-router"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import {
  getFirmNumber,
  getConversations,
  createConversation,
  archiveConversation,
  deleteConversation,
  getSmsUnreadCounts,
  updateConversationLabel,
} from "@/services/sms"
import { ConversationList } from "@/pages/sms/components/conversation-list"
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
import { formatPhone } from "@/lib/utils"

export default function SmsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newPhone, setNewPhone] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [searchValue, setSearchValue] = useState("")

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameLabel, setRenameLabel] = useState("")

  // URL-driven archived state
  const showArchived = searchParams.get("archived") === "true"
  const setShowArchived = useCallback(
    (show: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (show) {
            next.set("archived", "true")
          } else {
            next.delete("archived")
          }
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const debouncedSearch = useDebounce(searchValue, 300)

  const { data: firmNumber } = useQuery({
    queryKey: ["sms-firm-number"],
    queryFn: getFirmNumber,
    staleTime: Infinity,
  })

  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: ["sms-conversations", { archived: showArchived, search: debouncedSearch }],
    queryFn: () =>
      getConversations({
        archived: showArchived,
        search: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const conversations = conversationsData?.conversations ?? []

  const conversationIds = useMemo(
    () => conversations.map((c) => c.id),
    [conversations]
  )

  const { data: unreadCounts } = useQuery({
    queryKey: ["sms-unread-counts", conversationIds],
    queryFn: () => getSmsUnreadCounts(conversationIds),
    enabled: conversationIds.length > 0,
  })

  // Create conversation mutation
  const createMutation = useMutation({
    mutationFn: () => createConversation(newPhone, newLabel || undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
      setNewDialogOpen(false)
      setNewPhone("")
      setNewLabel("")
      navigate(`/sms/${data.id}`)
    },
    onError: () => {
      toast.error("Failed to create conversation")
    },
  })

  const archiveMutation = useMutation({
    mutationFn: ({
      conversationId,
      archived,
    }: {
      conversationId: number
      archived: boolean
    }) => archiveConversation(conversationId, archived),
    onSuccess: (_, { archived }) => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
      toast.success(archived ? "Conversation archived" : "Conversation unarchived")
    },
    onError: () => {
      toast.error("Failed to archive conversation")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (conversationId: number) => deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
      toast.success("Conversation deleted")
    },
    onError: () => {
      toast.error("Failed to delete conversation")
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, label }: { id: number; label: string }) =>
      updateConversationLabel(id, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
      setRenameDialogOpen(false)
      toast.success("Conversation renamed")
    },
    onError: () => {
      toast.error("Failed to rename conversation")
    },
  })

  const handleArchive = useCallback(
    (conversationId: number, archived: boolean) => {
      archiveMutation.mutate({ conversationId, archived })
    },
    [archiveMutation]
  )

  const handleDelete = useCallback(
    (conversationId: number) => {
      deleteMutation.mutate(conversationId)
    },
    [deleteMutation]
  )

  const handleRename = useCallback(
    (conversationId: number, currentLabel: string) => {
      setRenameId(conversationId)
      setRenameLabel(currentLabel)
      setRenameDialogOpen(true)
    },
    []
  )

  const handleRenameSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (renameId == null) return
      renameMutation.mutate({ id: renameId, label: renameLabel.trim() })
    },
    [renameId, renameLabel, renameMutation]
  )

  const handleCreateSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!newPhone.trim()) return
      createMutation.mutate()
    },
    [newPhone, createMutation]
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <ConversationList
        conversations={conversations}
        onNewConversation={() => setNewDialogOpen(true)}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onRename={handleRename}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        isLoading={loadingConversations}
        unreadCounts={unreadCounts}
        firmNumber={firmNumber ? formatPhone(firmNumber) : null}
      />

      {/* Rename conversation dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rename-label">Label</Label>
              <Input
                id="rename-label"
                placeholder="e.g. John Smith"
                value={renameLabel}
                onChange={(e) => setRenameLabel(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={renameMutation.isPending}
              >
                {renameMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New conversation dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="5551234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                placeholder="e.g. John Smith"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newPhone.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Start Conversation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
