import { useState, useRef, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useCasePreview } from "@/hooks/use-case-preview"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  PencilEdit01Icon,
  Link04Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import {
  getConversation,
  getMessages,
  sendMessage,
  markSmsConversationRead,
  updateConversationLabel,
  linkConversation,
} from "@/services/sms"
import { getCases } from "@/services/cases"
import { searchPersons } from "@/services/persons"
import { MessageThread } from "@/pages/sms/components/message-thread"
import { ComposeInput } from "@/pages/sms/components/compose-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getBadgeStyle } from "@/lib/badge-colors"
import { formatPhone } from "@/lib/utils"

export default function SmsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const conversationId = Number(id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { openCasePreview } = useCasePreview()

  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabel, setEditLabel] = useState("")
  const labelInputRef = useRef<HTMLInputElement>(null)

  // Fetch conversation info for header
  const { data: conversation } = useQuery({
    queryKey: ["sms-conversation", conversationId],
    queryFn: () => getConversation(conversationId),
    enabled: !isNaN(conversationId),
  })

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["sms-messages", conversationId],
    queryFn: () => getMessages(conversationId),
    enabled: !isNaN(conversationId),
  })

  const messages = messagesData?.messages ?? []

  // Mark as read on mount
  useQuery({
    queryKey: ["sms-mark-read", conversationId],
    queryFn: async () => {
      await markSmsConversationRead(conversationId)
      queryClient.invalidateQueries({ queryKey: ["sms-unread-counts"] })
      return null
    },
    enabled: !isNaN(conversationId),
    staleTime: 30_000,
  })

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessage(conversationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sms-messages", conversationId],
      })
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
    },
    onError: () => {
      toast.error("Failed to send message")
    },
  })

  const renameMutation = useMutation({
    mutationFn: (label: string) =>
      updateConversationLabel(conversationId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sms-conversation", conversationId],
      })
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
      setIsEditingLabel(false)
    },
    onError: () => {
      toast.error("Failed to update label")
    },
  })

  const linkMutation = useMutation({
    mutationFn: (data: { case_id?: number | null; person_id?: number | null }) =>
      linkConversation(conversationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-conversation", conversationId] })
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] })
    },
    onError: () => {
      toast.error("Failed to link conversation")
    },
  })

  useEffect(() => {
    if (isEditingLabel) {
      labelInputRef.current?.focus()
      labelInputRef.current?.select()
    }
  }, [isEditingLabel])

  function startEditing() {
    setEditLabel(conversation?.label || "")
    setIsEditingLabel(true)
  }

  function handleLabelSubmit() {
    const trimmed = editLabel.trim()
    if (trimmed === (conversation?.label || "")) {
      setIsEditingLabel(false)
      return
    }
    renameMutation.mutate(trimmed)
  }

  function handleLabelKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleLabelSubmit()
    } else if (e.key === "Escape") {
      setIsEditingLabel(false)
    }
  }

  if (isNaN(conversationId)) {
    navigate("/sms", { replace: true })
    return null
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
          <Link to="/sms">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          </Link>
        </Button>
        {isEditingLabel ? (
          <Input
            ref={labelInputRef}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={handleLabelSubmit}
            onKeyDown={handleLabelKeyDown}
            placeholder="Conversation label"
            className="h-7 w-48 text-sm"
            disabled={renameMutation.isPending}
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="group/label flex items-center gap-1.5 text-sm font-medium hover:text-foreground/80"
          >
            {conversation?.label ||
              (conversation?.phone_number
                ? formatPhone(conversation.phone_number)
                : "Loading...")}
            <HugeiconsIcon
              icon={PencilEdit01Icon}
              size={12}
              className="text-muted-foreground opacity-0 group-hover/label:opacity-100"
            />
          </button>
        )}
        {!isEditingLabel && conversation?.label && (
          <span className="text-xs text-muted-foreground">
            {formatPhone(conversation.phone_number)}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {conversation?.case_id && conversation.short_name && (
            <button
              type="button"
              onClick={() => conversation.case_id != null && openCasePreview(conversation.case_id)}
            >
              <Badge
                className="hover:opacity-80 transition-opacity cursor-pointer"
                style={getBadgeStyle(conversation.case_color)}
              >
                {conversation.short_name}
              </Badge>
            </button>
          )}
          {conversation?.person_id && conversation.person_name && (
            <Badge variant="secondary">{conversation.person_name}</Badge>
          )}
          <LinkPopover
            conversationId={conversationId}
            caseId={conversation?.case_id ?? null}
            personId={conversation?.person_id ?? null}
            onLink={(data) => linkMutation.mutate(data)}
          />
        </div>
      </div>

      {/* Messages */}
      <MessageThread messages={messages} isLoading={isLoading} />

      {/* Compose */}
      <ComposeInput
        onSend={(body) => sendMutation.mutate(body)}
        isSending={sendMutation.isPending}
      />
    </div>
  )
}

function LinkPopover({
  caseId,
  personId,
  onLink,
}: {
  conversationId: number
  caseId: number | null
  personId: number | null
  onLink: (data: { case_id?: number | null; person_id?: number | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const [caseSearch, setCaseSearch] = useState("")
  const [personSearch, setPersonSearch] = useState("")

  const { data: casesData } = useQuery({
    queryKey: ["cases-for-link", caseSearch],
    queryFn: () => getCases({ limit: 10 }),
    enabled: open,
    staleTime: 30_000,
  })

  const { data: personsData } = useQuery({
    queryKey: ["persons-for-link", personSearch],
    queryFn: () => searchPersons({ name: personSearch || undefined, limit: 10 }),
    enabled: open,
    staleTime: 30_000,
  })

  const cases = casesData?.cases ?? []
  const persons = personsData?.persons ?? []

  const filteredCases = caseSearch
    ? cases.filter(
        (c) =>
          c.case_name.toLowerCase().includes(caseSearch.toLowerCase()) ||
          (c.short_name?.toLowerCase().includes(caseSearch.toLowerCase()) ?? false)
      )
    : cases

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <HugeiconsIcon icon={Link04Icon} size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Case
              </span>
              {caseId && (
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onLink({ case_id: null })
                    setOpen(false)
                  }}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={10} className="inline mr-0.5" />
                  Unlink
                </button>
              )}
            </div>
            <Input
              placeholder="Search cases..."
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              className="h-7 text-xs"
            />
            <div className="max-h-28 overflow-y-auto space-y-0.5">
              {filteredCases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onLink({ case_id: c.id })
                    setOpen(false)
                  }}
                  className="flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-accent text-left"
                >
                  <Badge
                    className="text-[10px] px-1 py-0 shrink-0"
                    style={getBadgeStyle(c.color)}
                  >
                    {c.short_name}
                  </Badge>
                  <span className="truncate">{c.case_name}</span>
                </button>
              ))}
              {filteredCases.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">No cases found</p>
              )}
            </div>
          </div>

          <div className="border-t pt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Person
              </span>
              {personId && (
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onLink({ person_id: null })
                    setOpen(false)
                  }}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={10} className="inline mr-0.5" />
                  Unlink
                </button>
              )}
            </div>
            <Input
              placeholder="Search contacts..."
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              className="h-7 text-xs"
            />
            <div className="max-h-28 overflow-y-auto space-y-0.5">
              {persons.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onLink({ person_id: p.id })
                    setOpen(false)
                  }}
                  className="w-full px-2 py-1 text-xs hover:bg-accent text-left truncate"
                >
                  {p.name}
                </button>
              ))}
              {persons.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">No contacts found</p>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
