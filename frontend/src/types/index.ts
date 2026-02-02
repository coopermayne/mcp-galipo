// Barrel export - re-exports all types from domain-specific files
// This maintains backward compatibility with existing imports

// Common types (shared across domains)
export type {
  CaseStatus,
  TaskStatus,
  PersonType,
  PersonSide,
  PhoneEntry,
  EmailEntry,
  Jurisdiction,
  PaginatedResponse,
  DashboardStats,
  Constants,
  CalendarItem,
} from './common';

// Case types
export type {
  CaseNumber,
  Case,
  CaseSummary,
  CreateCaseInput,
  UpdateCaseInput,
} from './case';

// Task types
export type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
} from './task';

// Event types
export type {
  Event,
  CreateEventInput,
  UpdateEventInput,
} from './event';

// Note types
export type {
  Note,
  CreateNoteInput,
} from './note';

// Activity types
export type {
  Activity,
  CreateActivityInput,
  UpdateActivityInput,
} from './activity';

// Person types
export type {
  ExpertiseType,
  PersonTypeRecord,
  JudgeAttributes,
  ExpertAttributes,
  AttorneyAttributes,
  MediatorAttributes,
  ClientAttributes,
  PersonAttributes,
  Person,
  CasePersonAssignment,
  CasePerson,
  CreatePersonInput,
  UpdatePersonInput,
  AssignPersonInput,
  UpdateAssignmentInput,
} from './person';

// Proceeding types
export type {
  ProceedingJudge,
  Proceeding,
  CreateProceedingInput,
  UpdateProceedingInput,
  AddProceedingJudgeInput,
  UpdateProceedingJudgeInput,
} from './proceeding';

// Chat types
export type {
  ChatMode,
  ChatPreset,
  ToolCall,
  ToolResult,
  UsageRequest,
  UsageResponse,
  UsageData,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  StreamEventType,
  StreamEvent,
  ToolStatus,
  ToolExecution,
  Conversation,
} from './chat';

// Modal types
export type {
  EntityType,
  EntityModalState,
  EntityModalContextValue,
} from './modal';

// Timeline types
export type {
  ActivityTimelineItem,
  TaskTimelineItem,
  TimelineItem,
} from './timeline';

// User types
export type {
  UserPosition,
  User,
  CreateUserInput,
  UpdateUserInput,
} from './user';

// Tasks layout types (legacy - kept for backwards compat)
export type {
  LayoutPreset,
  TasksPanelConfig,
  TasksLayoutConfig,
} from './tasks-layout';

export {
  LAYOUT_PANEL_COUNTS,
  createDefaultPanel,
  createDefaultLayoutConfig,
  adjustPanelsForLayout,
} from './tasks-layout';

// Panel layout types (universal layout system)
export type {
  WidgetType,
  TasksGroupMode,
  EventsGroupMode,
  TasksWidgetConfig,
  EventsWidgetConfig,
  WidgetConfig,
  PanelLayoutConfig,
} from './panel-layout';

export {
  LAYOUT_CONTAINER_CLASSES,
  WIDGET_INFO,
  createDefaultTasksWidget,
  createDefaultEventsWidget,
  createDefaultWidget,
  getPanelClasses,
  adjustPanelsForLayout as adjustPanelsForLayoutGeneric,
} from './panel-layout';
