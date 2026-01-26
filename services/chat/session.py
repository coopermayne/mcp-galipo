"""
Session management for chat conversations.

Generates and manages session IDs that persist across messages in a chat conversation.
Session IDs are used to track operations for rollback capability.
"""

from uuid import UUID, uuid4
from typing import Optional
import threading


class SessionManager:
    """Manages chat session IDs.

    Each chat conversation gets a unique session ID that persists across
    messages. This allows the operation_log to track which operations
    belong to which conversation for rollback purposes.
    """

    def __init__(self):
        # Maps conversation_id (str) to session_id (UUID)
        self._sessions: dict[str, UUID] = {}
        self._lock = threading.Lock()

    def get_or_create_session(self, conversation_id: str) -> UUID:
        """Get existing session ID or create a new one for a conversation.

        Args:
            conversation_id: The chat conversation ID

        Returns:
            UUID session ID for database operation tracking
        """
        with self._lock:
            if conversation_id not in self._sessions:
                self._sessions[conversation_id] = uuid4()
            return self._sessions[conversation_id]

    def get_session(self, conversation_id: str) -> Optional[UUID]:
        """Get session ID for a conversation if it exists.

        Args:
            conversation_id: The chat conversation ID

        Returns:
            UUID session ID or None if not found
        """
        return self._sessions.get(conversation_id)

    def delete_session(self, conversation_id: str) -> bool:
        """Delete session tracking for a conversation.

        Called when a conversation is deleted.

        Args:
            conversation_id: The chat conversation ID

        Returns:
            True if session was deleted, False if not found
        """
        with self._lock:
            if conversation_id in self._sessions:
                del self._sessions[conversation_id]
                return True
            return False

    def clear_all(self) -> int:
        """Clear all session tracking. Returns count of cleared sessions."""
        with self._lock:
            count = len(self._sessions)
            self._sessions.clear()
            return count


# Global session manager instance
_session_manager = SessionManager()


def get_session_id(conversation_id: str) -> UUID:
    """Get or create a session ID for a conversation.

    Args:
        conversation_id: The chat conversation ID

    Returns:
        UUID session ID for database operation tracking
    """
    return _session_manager.get_or_create_session(conversation_id)


def delete_session(conversation_id: str) -> bool:
    """Delete session tracking for a conversation.

    Args:
        conversation_id: The chat conversation ID

    Returns:
        True if session was deleted
    """
    return _session_manager.delete_session(conversation_id)


def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    return _session_manager
