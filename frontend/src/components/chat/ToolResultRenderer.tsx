/**
 * ToolResultRenderer - Smart renderer for tool execution results
 *
 * Detects mutation tool results and renders interactive components
 * instead of raw JSON. Falls back to formatted JSON for other tools.
 */
import { ChatEventItem } from './ChatEventItem';
import type { Event } from '../../types';

interface ToolResultRendererProps {
  toolName: string;
  result: string;
  isError?: boolean;
  /** Render mode: 'full' shows interactive component, 'json' forces JSON display */
  mode?: 'full' | 'json';
}

/**
 * Mutation tools that create/update entities and return them.
 * Each consolidated manage_X tool returns its entity under this key.
 */
const ENTITY_MUTATION_TOOLS = {
  manage_event: 'event',
  manage_task: 'task',
  manage_note: 'note',
  manage_activity: 'activity',
  manage_person: 'person',
  manage_case: 'case',
  manage_proceeding: 'proceeding',
  manage_case_role: 'assignment',
} as const;

type MutationToolName = keyof typeof ENTITY_MUTATION_TOOLS;

/**
 * Check if a tool result has an interactive component available
 */
export function hasInteractiveResult(toolName: string, result: string, isError?: boolean): boolean {
  if (isError) return false;
  if (!isMutationTool(toolName)) return false;

  const parsed = parseResult(result);
  if (!parsed) return false;

  const entityKey = ENTITY_MUTATION_TOOLS[toolName];
  const entity = extractEntity(parsed, entityKey);

  if (toolName === 'manage_event' && isEvent(entity)) {
    return true;
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
 * Check if a tool is a mutation tool that returns an entity
 */
function isMutationTool(toolName: string): toolName is MutationToolName {
  return toolName in ENTITY_MUTATION_TOOLS;
}

/**
 * Extract the entity from a mutation result
 */
function extractEntity(parsed: unknown, entityKey: string): unknown | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // Check for success: true and the entity key
  if (obj.success === true && entityKey in obj) {
    return obj[entityKey];
  }

  return null;
}

/**
 * Type guard for Event objects
 */
function isEvent(entity: unknown): entity is Event {
  if (typeof entity !== 'object' || entity === null) return false;
  const obj = entity as Record<string, unknown>;
  return (
    typeof obj.id === 'number' &&
    typeof obj.case_id === 'number' &&
    typeof obj.date === 'string' &&
    typeof obj.description === 'string'
  );
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

  // Check if this is a mutation tool with entity data
  if (parsed && isMutationTool(toolName)) {
    const entityKey = ENTITY_MUTATION_TOOLS[toolName];
    const entity = extractEntity(parsed, entityKey);

    // Render event items from manage_event
    if (toolName === 'manage_event' && isEvent(entity)) {
      return (
        <ChatEventItem
          event={entity}
          isNew={true}
        />
      );
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
