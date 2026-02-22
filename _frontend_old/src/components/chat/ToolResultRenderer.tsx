/**
 * ToolResultRenderer - Smart renderer for tool execution results
 *
 * Detects mutation tool results and renders interactive components
 * instead of raw JSON. Falls back to formatted JSON for other tools.
 */
import { ChatEventItem } from './ChatEventItem';
import { ChatIntakeItem, ChatIntakePreview } from './ChatIntakeItem';

interface ToolResultRendererProps {
  toolName: string;
  result: string;
  isError?: boolean;
  /** Render mode: 'full' shows interactive component, 'json' forces JSON display */
  mode?: 'full' | 'json';
}

/**
 * Check if a tool result has an interactive component available
 */
export function hasInteractiveResult(toolName: string, result: string, isError?: boolean): boolean {
  if (isError) return false;

  const parsed = parseResult(result);
  if (!parsed) return false;

  if (toolName === 'manage_event') {
    const eventId = extractEntityId(parsed, 'event_id');
    return eventId !== null;
  }

  if (toolName === 'manage_intake') {
    const obj = parsed as Record<string, unknown>;
    if (obj.success === true && typeof obj.intake_id === 'number') return true;
    if (obj.success === true && obj.preview === true) return true;
  }

  return false;
}

/**
 * Parse result string into JSON, returns null if invalid
 */
function parseResult(result: string): unknown {
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}

/**
 * Extract an entity ID from a mutation result
 */
function extractEntityId(parsed: unknown, idKey: string): number | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  if (obj.success === true && typeof obj[idKey] === 'number') {
    return obj[idKey] as number;
  }

  return null;
}

export function ToolResultRenderer({ toolName, result, isError, mode = 'full' }: ToolResultRendererProps) {
  // Don't try to render interactive components for errors
  if (isError) {
    return <JsonResult result={result} isError />;
  }

  // Force JSON mode if requested
  if (mode === 'json') {
    return <JsonResult result={result} />;
  }

  const parsed = parseResult(result);

  // Render interactive event card from manage_event
  if (parsed && toolName === 'manage_event') {
    const eventId = extractEntityId(parsed, 'event_id');
    if (eventId !== null) {
      return <ChatEventItem eventId={eventId} isNew={true} />;
    }
  }

  // Render intake cards from manage_intake
  if (parsed && toolName === 'manage_intake') {
    const obj = parsed as Record<string, unknown>;
    if (obj.success === true && typeof obj.intake_id === 'number') {
      return <ChatIntakeItem intakeId={obj.intake_id as number} isNew={true} />;
    }
    if (obj.success === true && obj.preview === true && typeof obj.fields === 'object' && obj.fields !== null) {
      return <ChatIntakePreview fields={obj.fields as Record<string, unknown>} />;
    }
  }

  // Fallback to JSON display
  return <JsonResult result={result} />;
}

/**
 * Formatted JSON result display (fallback)
 */
function JsonResult({ result, isError }: { result: string; isError?: boolean }) {
  const formatted = (() => {
    try {
      const parsed = JSON.parse(result);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return result;
    }
  })();

  return (
    <pre
      className={`text-xs rounded p-2 overflow-x-auto max-h-48 overflow-y-auto ${
        isError
          ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
          : 'text-text-secondary bg-bg-surface'
      }`}
    >
      {formatted}
    </pre>
  );
}
