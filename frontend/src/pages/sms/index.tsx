import { useState, useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDebounce } from "@/hooks/use-debounce"
import {
  getFirmNumber,
  getConversations,
  getMessages,
  sendMessage,
  createConversation,
  archiveConversation,
  deleteConversation,
  getSmsUnreadCounts,
  markSmsConversationRead,
} from "@/services/sms"
import { ConversationList } from "@/pages/sms/components/conversation-list"
import { MessageThread } from "@/pages/sms/components/message-thread"
import { ComposeInput } from "@/pages/sms/components/compose-input"
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newPhone, setNewPhone] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [searchValue, setSearchValue] = useState("")

  // URL-driven archived state (same pattern as contacts page)
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
      // Clear selection when switching views
      setSelectedConversationId(null)
    },
    [setSearchParams]
  )

  // Debounce search for API calls
  const debouncedSearch = useDebounce(searchValue, 300)

  // Fetch firm phone number for display
  const { data: firmNumber } = useQuery({
    queryKey: ["sms-firm-number"],
    queryFn: getFirmNumber,
    staleTime: Infinity,
  })

  // Fetch conversations with archive + search filters
  const { data: conversationsData, isLoading: loadingConversations } = useQuery(
    {
      queryKey: ["sms-conversations", { archived: showArchived, search: debouncedSearch }],
      queryFn: () =>
        getConversations({
          archived: showArchived,
          search: debouncedSearch || undefined,
        }),
    }
  )

  const conversations = conversationsData?.conversations ?? []

  // Derive conversation IDs for unread count lookup
  const conversationIds = useMemo(
    () => conversations.map((c) => c.id),
    [conversations]
  )

  // Fetch unread counts for visible conversations
  const { data: unreadCounts } = useQuery({
    queryKey: ["sms-unread-counts", conversationIds],
    queryFn: () => getSmsUnreadCounts(conversationIds),
    enabled: conversationIds.length > 0,
  })

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ["sms-messages", selectedConversationId],
    queryFn: () => getMessages(selectedConversationId!),
    enabled: selectedConversationId != null,
  })

  const messages = messagesData?.messages ?? []

  // Handle selecting a conversation — also marks it as read
  const handleSelectConversation = useCallback(
    (id: number) => {
      setSelectedConversationId(id)
      markSmsConversationRead(id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["sms-unread-counts"] })
      })
    },
    [queryClient]
  )

  // Get selected conversation info
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  )

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessage(selectedConversationId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sms-messages", selectedConversationId],
      })
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
    },
    onError: () => {
      toast.error("Failed to send message")
    },
  })

  // Create conversation mutation
  const createMutation = useMutation({
    mutationFn: () => createConversation(newPhone, newLabel || undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
      setSelectedConversationId(data.id)
      setNewDialogOpen(false)
      setNewPhone("")
      setNewLabel("")
    },
    onError: () => {
      toast.error("Failed to create conversation")
    },
  })

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: ({
      conversationId,
      archived,
    }: {
      conversationId: number
      archived: boolean
    }) => archiveConversation(conversationId, archived),
    onSuccess: (_, { conversationId, archived }) => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null)
      }
      toast.success(archived ? "Conversation archived" : "Conversation unarchived")
    },
    onError: () => {
      toast.error("Failed to archive conversation")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (conversationId: number) => deleteConversation(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null)
      }
      toast.success("Conversation deleted")
    },
    onError: () => {
      toast.error("Failed to delete conversation")
    },
  })

  const handleDelete = useCallback(
    (conversationId: number) => {
      deleteMutation.mutate(conversationId)
    },
    [deleteMutation]
  )

  const handleNewConversation = useCallback(() => {
    setNewDialogOpen(true)
  }, [])

  const handleCreateSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!newPhone.trim()) return
      createMutation.mutate()
    },
    [newPhone, createMutation]
  )

  const handleArchive = useCallback(
    (conversationId: number, archived: boolean) => {
      archiveMutation.mutate({ conversationId, archived })
    },
    [archiveMutation]
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="flex w-72 shrink-0 flex-col border-r lg:w-80">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onArchive={handleArchive}
          onDelete={handleDelete}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isLoading={loadingConversations}
          unreadCounts={unreadCounts}
          firmNumber={firmNumber ? formatPhone(firmNumber) : null}
        />
      </div>

      {/* Right panel — message thread */}
      <div className="flex flex-1 flex-col">
        {selectedConversationId == null ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Select a conversation or start a new one
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <h2 className="text-sm font-medium">
                {selectedConversation?.label ||
                  selectedConversation?.phone_number ||
                  "Conversation"}
              </h2>
              {selectedConversation?.label && (
                <span className="text-xs text-muted-foreground">
                  {selectedConversation.phone_number}
                </span>
              )}
            </div>

            <MessageThread
              messages={messages}
              isLoading={loadingMessages}
            />

            <ComposeInput
              onSend={(body) => sendMutation.mutate(body)}
              isSending={sendMutation.isPending}
            />
          </>
        )}
      </div>

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
