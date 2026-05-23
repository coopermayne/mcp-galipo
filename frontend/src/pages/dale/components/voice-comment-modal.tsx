import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MicIcon,
  StopIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { postDaleComment, type DaleEntityType } from "@/services/dale"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: DaleEntityType
  entityId: number
  contextLabel: string
  onSaved?: () => void
}

type SpeechRecognitionLike = {
  start: () => void
  stop: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (e: SpeechRecognitionEvent) => void
  onerror: (e: { error: string }) => void
  onend: () => void
}

// minimal shape — the browser API isn't in the standard TS lib types
type SpeechRecognitionEvent = {
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

function getRecognizer(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null
  return new Ctor()
}

export function VoiceCommentModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  contextLabel,
  onSaved,
}: Props) {
  const [transcript, setTranscript] = useState("")
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [supported, setSupported] = useState<boolean | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const finalsRef = useRef<string>("")

  // start recording automatically when the modal opens
  useEffect(() => {
    if (!open) {
      // teardown on close
      try {
        recRef.current?.stop()
      } catch {
        /* noop */
      }
      recRef.current = null
      setTranscript("")
      setRecording(false)
      finalsRef.current = ""
      return
    }

    const rec = getRecognizer()
    if (!rec) {
      setSupported(false)
      return
    }
    setSupported(true)
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "en-US"
    rec.onresult = (e) => {
      let interim = ""
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          finalsRef.current += r[0].transcript
        } else {
          interim += r[0].transcript
        }
      }
      setTranscript((finalsRef.current + interim).trim())
    }
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone access blocked")
        setSupported(false)
      }
      setRecording(false)
    }
    rec.onend = () => setRecording(false)

    recRef.current = rec
    try {
      rec.start()
      setRecording(true)
    } catch {
      setRecording(false)
    }
  }, [open])

  const stopRecording = () => {
    try {
      recRef.current?.stop()
    } catch {
      /* noop */
    }
    setRecording(false)
  }

  const save = async () => {
    const content = transcript.trim()
    if (!content) {
      toast.error("Nothing to save yet")
      return
    }
    setSaving(true)
    try {
      await postDaleComment(entityType, entityId, content)
      toast.success("Note saved")
      onSaved?.()
      onOpenChange(false)
    } catch {
      toast.error("Couldn't save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 p-6">
        <DialogTitle className="text-xl">Leave a note</DialogTitle>
        <p className="text-sm text-muted-foreground">on {contextLabel}</p>

        {supported === false ? (
          <div className="space-y-3 py-2">
            <p className="text-base">
              Voice isn't available in this browser. You can type your note
              instead.
            </p>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Type your note…"
              className="min-h-32 text-base"
            />
          </div>
        ) : (
          <>
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={recording ? stopRecording : undefined}
                disabled={!recording}
                className={cn(
                  "flex h-24 w-24 items-center justify-center text-white transition-colors",
                  recording ? "bg-red-600" : "bg-muted text-muted-foreground",
                )}
                aria-label={recording ? "Stop recording" : "Recording stopped"}
              >
                <HugeiconsIcon
                  icon={recording ? StopIcon : MicIcon}
                  size={40}
                  strokeWidth={2}
                />
              </button>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {recording ? "Listening… tap to stop" : "Review and save"}
            </p>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your note will appear here…"
              className="min-h-32 text-base"
            />
          </>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-14 flex-1 text-base"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || !transcript.trim()}
            className="h-14 flex-1 text-base"
          >
            {saving ? (
              <HugeiconsIcon icon={Loading03Icon} size={20} className="animate-spin" />
            ) : (
              "Save note"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
