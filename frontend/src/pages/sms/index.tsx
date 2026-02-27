import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getConversations,
  getMessages,
  sendMessage,
  createConversation,
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

export default function SmsPage() {
  const queryClient = useQueryClient()
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newPhone, setNewPhone] = useState("")
  const [newLabel, setNewLabel] = useState("")

  // Fetch conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery(
    {
      queryKey: ["sms-conversations"],
      queryFn: () => getConversations(),
    }
  )

  const conversations = conversationsData?.conversations ?? []

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ["sms-messages", selectedConversationId],
    queryFn: () => getMessages(selectedConversationId!),
    enabled: selectedConversationId != null,
  })

  const messages = messagesData?.messages ?? []

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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="flex w-72 shrink-0 flex-col border-r lg:w-80">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          onNewConversation={handleNewConversation}
          isLoading={loadingConversations}
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
                placeholder="+1 (555) 123-4567"
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
