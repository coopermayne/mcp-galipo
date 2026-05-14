import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"
import { DatePicker } from "@/components/ui/date-picker"

interface InlineEditFieldProps {
  value: string
  onSave: (value: string) => void
  type?: "text" | "date" | "textarea"
  placeholder?: string
  className?: string
  displayClassName?: string
}

export function InlineEditField(props: InlineEditFieldProps) {
  if (props.type === "date") {
    return (
      <DatePicker
        value={props.value || null}
        onChange={(date) => props.onSave(date ?? "")}
        variant="inline"
        placeholder={props.placeholder ?? "—"}
        className={props.displayClassName}
      />
    )
  }

  return <InlineEditFieldInner {...props} />
}

function InlineEditFieldInner({
  value,
  onSave,
  type = "text",
  placeholder = "—",
  className,
  displayClassName,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== value) onSave(trimmed)
  }

  function cancel() {
    setEditing(false)
    setDraft(value)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      cancel()
    } else if (e.key === "Enter" && type !== "textarea") {
      commit()
    }
  }

  if (editing) {
    const shared = {
      ref: inputRef as React.Ref<HTMLInputElement & HTMLTextAreaElement>,
      value: draft,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      className: cn(
        "w-full bg-transparent border border-input px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring",
        className
      ),
    }

    if (type === "textarea") {
      return <textarea {...shared} rows={3} />
    }
    return <input {...shared} type={type} />
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "group/edit flex items-start gap-1 text-left text-sm hover:text-foreground transition-colors min-w-0 w-full",
        !value && "text-muted-foreground",
        displayClassName
      )}
    >
      <span className="break-words">{value || placeholder}</span>
      <HugeiconsIcon
        icon={PencilEdit01Icon}
        className="size-3 shrink-0 opacity-0 group-hover/edit:opacity-50 transition-opacity"
      />
    </button>
  )
}
