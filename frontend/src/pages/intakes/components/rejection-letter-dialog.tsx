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
import type { Intake } from "@/types/intake"

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

const PRACTICE_AREAS = [
  "Officer-Involved Shootings",
  "In-Custody Death",
  "Excessive Use of Force (resulting in permanent physical disability or death)",
  "Restraint / Asphyxia (resulting in permanent physical disability or death)",
  "Denial of Medical Care while in custody (resulting in permanent physical disability or death)",
  "Wrongful Conviction (resulting in a Factual Finding of Innocence)",
]

function buildRejectionLetter(intake: Intake): string {
  const greeting = pacificGreeting()
  const name = intake.name?.trim() || "[Client Name]"

  return [
    `${greeting} ${name},`,
    ``,
    `Thank you for submitting your case to The Law Offices of Dale K. Galipo. Your rights are important to us! After careful consideration of the information provided about the basic facts of your case, we have concluded that we are not able to represent you in your legal matter since the specific nature of your case does not fall within the limited scope of our practice which is:`,
    ``,
    ...PRACTICE_AREAS.map((area) => `  • ${area}`),
    ``,
    `Please understand that this is not intended to be an opinion concerning the merits of your case. We are merely indicating that we are not able to assist you in the important matter you have submitted to us for consideration.`,
    ``,
    `If you intend to pursue these claims, you should immediately contact another attorney to obtain legal representation. You should be aware that there are strict time limitations within which you must act to preserve and protect your rights in this matter. Failure to file a claim and/or lawsuit within the requisite time may mean that you could be barred forever from pursuing your action.`,
    ``,
    `Thank you again for contacting The Law Offices of Dale K. Galipo and we hope you find justice in pursuing your case!`,
    ``,
    `Respectfully,`,
  ].join("\n")
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Convert the editable plain-text letter into HTML so it pastes into email
// clients as formatted paragraphs and a bulleted list.
function letterToHtml(text: string): string {
  const lines = text.split("\n")
  const blocks: string[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(`<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`)
      bullets = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const bulletMatch = trimmed.match(/^•\s*(.*)$/)
    if (bulletMatch) {
      bullets.push(bulletMatch[1])
      continue
    }
    flushBullets()
    if (trimmed) blocks.push(`<p>${escapeHtml(trimmed)}</p>`)
  }
  flushBullets()

  return `<div>${blocks.join("")}</div>`
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
  const [letter, setLetter] = useState("")

  useEffect(() => {
    if (open) setLetter(buildRejectionLetter(intake))
  }, [open, intake])

  async function handleCopy() {
    try {
      const html = letterToHtml(letter)
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([letter], { type: "text/plain" }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(letter)
      }
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
