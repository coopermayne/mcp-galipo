import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Message01Icon } from "@hugeicons/core-free-icons"
import { createConversation } from "@/services/sms"
import { cn } from "@/lib/utils"

interface SmsLaunchButtonProps {
  phone: string
  /** Default label applied if a new conversation is created. Ignored if a conversation already exists for this phone. */
  label?: string
  caseId?: number
  personId?: number
  className?: string
  title?: string
}

export function SmsLaunchButton({
  phone,
  label,
  caseId,
  personId,
  className,
  title = "Start or continue SMS conversation",
}: SmsLaunchButtonProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createConversation(phone, label, caseId, personId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sms"] })
      navigate(`/sms/${result.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        mutation.mutate()
      }}
      disabled={mutation.isPending || !phone}
      title={title}
      className={cn(
        "inline-flex items-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      <HugeiconsIcon icon={Message01Icon} className="size-3.5" />
      <span className="sr-only">{title}</span>
    </button>
  )
}
