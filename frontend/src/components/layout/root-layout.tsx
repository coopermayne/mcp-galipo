import { useState, useEffect, useMemo } from "react"
import { Navigate, Outlet, useLocation } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"
import { useAuth } from "@/hooks/use-auth"
import { useSSE } from "@/hooks/use-sse"
import { usePageTracking } from "@/hooks/use-page-tracking"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QuickCaseSearch } from "@/components/common/quick-case-search"
import { AiChatSheet, type ToolCompletionRule } from "@/components/common/ai-chat-sheet"
import { CasePreviewProvider } from "@/hooks/use-case-preview"
import { Button } from "@/components/ui/button"

/** Extract case ID from the current URL path if on a case detail page. */
function useCaseContext(): number | undefined {
  const location = useLocation()
  const match = location.pathname.match(/^\/cases\/(\d+)$/)
  return match ? Number(match[1]) : undefined
}

const GENERAL_CHAT_RULES: ToolCompletionRule[] = [
  { toolNames: ["manage_task"], queryKeys: [["tasks"]], toastMessage: "Task updated via AI" },
  { toolNames: ["manage_event"], queryKeys: [["events"]], toastMessage: "Event updated via AI" },
  { toolNames: ["manage_note"], queryKeys: [["notes"]], toastMessage: "Note updated via AI" },
  { toolNames: ["manage_case", "manage_case_staff"], queryKeys: [["cases"]], toastMessage: "Case updated via AI" },
  { toolNames: ["manage_person", "manage_case_role", "merge_persons"], queryKeys: [["cases"], ["persons"]], toastMessage: "Person updated via AI" },
  { toolNames: ["manage_proceeding", "manage_judge"], queryKeys: [["cases"], ["judges"]], toastMessage: "Proceeding updated via AI" },
  { toolNames: ["manage_intake"], queryKeys: [["intakes"]], toastMessage: "Intake updated via AI" },
  { toolNames: ["reschedule_overdue"], queryKeys: [["tasks"]], toastMessage: "Tasks rescheduled via AI" },
]

export function RootLayout() {
  const { user, isLoading } = useAuth()
  useSSE()
  usePageTracking()

  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const caseContext = useCaseContext()

  // Add case-specific query invalidation when on a case page
  const chatRules = useMemo(() => {
    if (!caseContext) return GENERAL_CHAT_RULES
    return GENERAL_CHAT_RULES.map((rule) => ({
      ...rule,
      queryKeys: [...rule.queryKeys, ["case", caseContext]],
    }))
  }, [caseContext])

  useEffect(() => {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "g" && (isMac ? e.ctrlKey : e.altKey)) {
        e.preventDefault()
        setQuickSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <TooltipProvider>
      <CasePreviewProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-10 items-center px-4 md:hidden">
            <SidebarTrigger />
          </div>
          <div className="mx-auto w-full max-w-[1600px] flex-1 overflow-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <QuickCaseSearch open={quickSearchOpen} onOpenChange={setQuickSearchOpen} />
      {user.visibleFeatures?.includes("ai-chat") && (
        <Button
          size="icon"
          className="fixed bottom-5 right-5 z-50 size-12 shadow-lg"
          onClick={() => setChatOpen(true)}
        >
          <HugeiconsIcon icon={SparklesIcon} className="size-5" />
        </Button>
      )}
      <AiChatSheet
        open={chatOpen}
        onOpenChange={setChatOpen}
        title="AI Chat"
        description="Ask anything about your cases, tasks, events, contacts, and more."
        placeholder="e.g. What are my upcoming deadlines? Show me the Martinez case..."
        emptyStateText="Ask me anything. I can search cases, create tasks and events, manage contacts, and more."
        mode="full"
        caseContext={caseContext}
        toolCompletionRules={chatRules}
      />
      </CasePreviewProvider>
    </TooltipProvider>
  )
}
