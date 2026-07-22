import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { ContactDetailDialog } from "@/components/common/contact-detail-dialog"
import type { PersonListItem } from "@/types/person"

/** Minimal person shape needed to open the preview. The dialog re-fetches full
 *  detail (roles, address, notes, SMS…) itself, so only id + name are required;
 *  any extra fields just make the modal render richer before hydration. */
export type PersonPreviewInput = { id: number; name: string } & Partial<PersonListItem>

type PersonPreviewContextValue = {
  /** Open the person detail modal over the current page. */
  openPersonPreview: (person: PersonPreviewInput) => void
  /** Close the person detail modal. */
  closePersonPreview: () => void
}

const PersonPreviewContext = createContext<PersonPreviewContextValue | null>(null)

function toListItem(p: PersonPreviewInput): PersonListItem {
  return {
    id: p.id,
    name: p.name,
    phones: p.phones ?? [],
    emails: p.emails ?? [],
    organization: p.organization ?? null,
    notes: p.notes ?? null,
    archived: p.archived ?? null,
    created_at: p.created_at ?? null,
    roles: p.roles,
  }
}

/**
 * App-level provider that renders a single ContactDetailDialog and lets any
 * component open it via `usePersonPreview().openPersonPreview(person)`. Selecting
 * a person anywhere (e.g. quick search) opens this modal over the current page
 * instead of navigating away, so closing it returns the user where they started.
 */
export function PersonPreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewPerson, setPreviewPerson] = useState<PersonListItem | null>(null)

  const openPersonPreview = useCallback((person: PersonPreviewInput) => {
    setPreviewPerson(toListItem(person))
  }, [])

  const closePersonPreview = useCallback(() => {
    setPreviewPerson(null)
  }, [])

  const value = useMemo(
    () => ({ openPersonPreview, closePersonPreview }),
    [openPersonPreview, closePersonPreview]
  )

  return (
    <PersonPreviewContext.Provider value={value}>
      {children}
      <ContactDetailDialog
        person={previewPerson}
        open={previewPerson != null}
        onOpenChange={(open) => {
          if (!open) setPreviewPerson(null)
        }}
      />
    </PersonPreviewContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePersonPreview() {
  const context = useContext(PersonPreviewContext)
  if (!context) {
    throw new Error("usePersonPreview must be used within a PersonPreviewProvider")
  }
  return context
}
