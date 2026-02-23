import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { INVALIDATION_MAP, isServerSideAction } from "@/lib/sse-invalidation-map"
import type { SSEEvent } from "@/types/sse"

const MIN_RETRY_MS = 3_000
const MAX_RETRY_MS = 30_000

export function useSSE() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const retryDelay = useRef(MIN_RETRY_MS)

  useEffect(() => {
    if (!user) return

    let es: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let unmounted = false

    function connect() {
      if (unmounted) return

      const token = localStorage.getItem("token")
      const url = token
        ? `/api/v1/stream?token=${encodeURIComponent(token)}`
        : `/api/v1/stream`

      es = new EventSource(url)

      es.onopen = () => {
        retryDelay.current = MIN_RETRY_MS
      }

      es.onmessage = (msg) => {
        let event: SSEEvent
        try {
          event = JSON.parse(msg.data)
        } catch {
          return
        }

        // Skip own events unless it's a server-side action
        if (
          event.user_id &&
          event.user_id === user!.id &&
          !isServerSideAction(event.action)
        ) {
          return
        }

        const getKeys = INVALIDATION_MAP[event.entity]
        if (!getKeys) return

        const keys = getKeys(event)
        for (const key of keys) {
          const queryKey = typeof key === "string" ? [key] : key
          queryClient.invalidateQueries({ queryKey })
        }
      }

      es.onerror = () => {
        es?.close()
        es = null
        if (unmounted) return

        timer = setTimeout(() => {
          retryDelay.current = Math.min(
            retryDelay.current * 2,
            MAX_RETRY_MS,
          )
          connect()
        }, retryDelay.current)
      }
    }

    connect()

    return () => {
      unmounted = true
      es?.close()
      if (timer) clearTimeout(timer)
    }
  }, [user, queryClient])
}
