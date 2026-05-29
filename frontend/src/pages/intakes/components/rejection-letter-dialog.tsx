import { useEffect, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon } from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import type { Intake } from "@/types/intake"
import type { AuthUser } from "@/types/auth"

function pacificGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  )
  return hour < 12 ? "Good morning" : "Good afternoon"
}

function formatIncidentDate(date: string | null): string | null {
  if (!date) return null
  // Date-only field: append midnight so it isn't shifted by timezone parsing.
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function buildRejectionLetter(intake: Intake, user: AuthUser | null): string {
  const greeting = pacificGreeting()
  const name = intake.name?.trim() || "[Client Name]"
  const doi = formatIncidentDate(intake.incident_date)

  const solSentence = doi
    ? `Please also be aware that, based on your incident date of ${doi}, there may be a statute of limitations deadline approaching.`
    : `Please also be aware that, based on the date of your incident, there may be a statute of limitations deadline approaching.`

  const signature = user
    ? [`${user.firstName} ${user.lastName}`, user.position].filter(Boolean).join("\n")
    : "[Your Name]"

  return [
    `${greeting} ${name},`,
    ``,
    `Thank you for contacting our office regarding your potential case. After carefully reviewing the information you provided, we have determined that we are unable to represent you in this matter.`,
    ``,
    `${solSentence} The statute of limitations is a strict legal deadline for filing a claim and/or complaint, and once it passes you may permanently lose the right to pursue your case. For that reason, we strongly encourage you to consult with another attorney as soon as possible to protect your rights.`,
    ``,
    `We wish you the best in resolving this matter.`,
    ``,
    `Sincerely,`,
    ``,
    signature,
  ].join("\n")
}

interface RejectionLetterDialogProps {
  intake: Intake
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RejectionLetterDialog({
  intake,
  open,
  onOpenChange,
}: RejectionLetterDialogProps) {
  const { user } = useAuth()
  const [letter, setLetter] = useState("")

  useEffect(() => {
    if (open) setLetter(buildRejectionLetter(intake, user))
  }, [open, intake, user])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(letter)
      toast.success("Letter copied to clipboard")
    } catch {
      toast.error("Failed to copy letter")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rejection Letter</DialogTitle>
          <DialogDescription>
            Draft rejection letter for {intake.name || "this intake"}. Review and edit before sending.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          className="min-h-[320px] text-sm whitespace-pre-wrap"
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleCopy} className="gap-1.5">
            <HugeiconsIcon icon={Copy01Icon} className="size-4" />
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
