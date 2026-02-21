import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '../context/AuthContext';

/**
 * Opens an SSE connection to /api/v1/intakes/stream and invalidates
 * TanStack Query caches when changes are broadcast from the server.
 */
export function useIntakeSSE() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function connect() {
      if (closed) return;

      const token = getAuthToken();
      // Build URL — token is optional (dev mode may not have one)
      const params = new URLSearchParams();
      if (token) params.set('token', token);

      const url = `/api/v1/intakes/stream?${params}`;
      es = new EventSource(url);

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);

          if (data.entity === 'intake') {
            queryClient.invalidateQueries({ queryKey: ['intakes'] });
            queryClient.invalidateQueries({ queryKey: ['intake-unread-counts'] });
            queryClient.invalidateQueries({ queryKey: ['intake-activity'] });
            if (data.intake_id) {
              queryClient.invalidateQueries({ queryKey: ['intake', data.intake_id] });
            }
          } else if (data.entity === 'intake_comment') {
            queryClient.invalidateQueries({
              queryKey: ['intake-comments', data.intake_id],
            });
            queryClient.invalidateQueries({ queryKey: ['intake-unread-counts'] });
          }
        } catch {
          // Ignore malformed events
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [queryClient]);
}
