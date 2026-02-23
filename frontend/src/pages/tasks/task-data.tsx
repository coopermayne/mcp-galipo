import type { ComponentType } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowUp02Icon,
  ArrowUp01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"

// --- SVG status icons (square-based) ---

export function PendingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function ActiveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" stroke="currentColor" strokeWidth="2" />
      <path
        d="M10 8l6 4-6 4z"
        fill="currentColor"
        style={{ animation: "task-spin-pause 3s ease-in-out infinite", transformOrigin: "12px 12px" }}
      />
    </svg>
  )
}

export function DoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PartiallyDoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function BlockedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" stroke="currentColor" strokeWidth="2" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function AwaitingReviewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" stroke="currentColor" strokeWidth="2" />
      <rect x="7" y="11" width="2" height="2" fill="currentColor" />
      <rect x="11" y="11" width="2" height="2" fill="currentColor" />
      <rect x="15" y="11" width="2" height="2" fill="currentColor" />
    </svg>
  )
}

// --- Config arrays ---

export interface StatusOption {
  value: string
  label: string
  icon: ComponentType<{ className?: string }>
  iconColor: string
}

export interface UrgencyOption {
  value: string
  label: string
  icon: ComponentType<{ className?: string }>
  iconColor: string
}

export const statuses: StatusOption[] = [
  { value: "Pending", label: "Pending", icon: PendingIcon, iconColor: "text-muted-foreground" },
  { value: "Active", label: "Active", icon: ActiveIcon, iconColor: "text-info" },
  { value: "Partially Done", label: "Partially Done", icon: PartiallyDoneIcon, iconColor: "text-purple" },
  { value: "Blocked", label: "Blocked", icon: BlockedIcon, iconColor: "text-destructive" },
  { value: "Awaiting Atty Review", label: "Awaiting Review", icon: AwaitingReviewIcon, iconColor: "text-warning" },
  { value: "Done", label: "Done", icon: DoneIcon, iconColor: "text-success" },
]

function HugeArrowUp02({ className }: { className?: string }) {
  return <HugeiconsIcon icon={ArrowUp02Icon} className={className} />
}
function HugeArrowUp01({ className }: { className?: string }) {
  return <HugeiconsIcon icon={ArrowUp01Icon} className={className} />
}
function HugeArrowRight01({ className }: { className?: string }) {
  return <HugeiconsIcon icon={ArrowRight01Icon} className={className} />
}
function HugeArrowDown01({ className }: { className?: string }) {
  return <HugeiconsIcon icon={ArrowDown01Icon} className={className} />
}

export const urgencies: UrgencyOption[] = [
  { value: "Urgent", label: "Urgent", icon: HugeArrowUp02, iconColor: "text-destructive" },
  { value: "High", label: "High", icon: HugeArrowUp01, iconColor: "text-warning" },
  { value: "Medium", label: "Medium", icon: HugeArrowRight01, iconColor: "text-info" },
  { value: "Low", label: "Low", icon: HugeArrowDown01, iconColor: "text-muted-foreground" },
]
