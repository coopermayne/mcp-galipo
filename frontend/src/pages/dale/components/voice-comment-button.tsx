import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MicIcon } from "@hugeicons/core-free-icons"
import { VoiceCommentModal } from "./voice-comment-modal"
import type { DaleEntityType } from "@/services/dale"

interface Props {
  entityType: DaleEntityType
  entityId: number
  contextLabel: string
  onSaved?: () => void
}

export function VoiceCommentButton({
  entityType,
  entityId,
  contextLabel,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Leave a voice note"
        className="fixed bottom-24 right-4 z-10 flex h-16 w-16 items-center justify-center bg-foreground text-background shadow-lg active:translate-y-px"
      >
        <HugeiconsIcon icon={MicIcon} size={28} strokeWidth={2.2} />
      </button>
      <VoiceCommentModal
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        entityId={entityId}
        contextLabel={contextLabel}
        onSaved={onSaved}
      />
    </>
  )
}
