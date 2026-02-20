// Barrel export - re-exports all types from domain-specific files
// This maintains backward compatibility with existing imports

// Common types (shared across domains)
export type {
  CaseStatus,
  TaskStatus,
  RoleCategory,
  RoleRef,
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
  Case,
  CaseSummary,
  CreateCaseInput,
  UpdateCaseInput,
} from './case';

// Task types
export type {
  Task,
  TaskAssignee,
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

// Role types
export type {
  Role,
  CreateRoleInput,
  UpdateRoleInput,
} from './role';

// Judge types
export type {
  Judge,
  JudgeProceeding,
  CreateJudgeInput,
  UpdateJudgeInput,
} from './judge';

// Person types
export type {
  ExpertiseType,
  PersonRoleRef,
  ExpertAttributes,
  AttorneyAttributes,
  MediatorAttributes,
  ClientAttributes,
  PersonAttributes,
  PersonRole,
  Person,
  CasePersonAssignment,
  CasePerson,
  CreatePersonInput,
  UpdatePersonInput,
  AssignPersonInput,
  UpdateAssignmentInput,
  ChangeRoleInput,
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
  TimelineItem,
} from './timeline';

// User types
export type {
  UserPosition,
  UserRef,
  User,
  CreateUserInput,
  UpdateUserInput,
  CaseStaffUser,
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
  CaseAttorneyFilter,
  TasksWidgetConfig,
  EventsWidgetConfig,
  CasesWidgetConfig,
  ChartWidgetConfig,
  WidgetConfig,
  PanelLayoutConfig,
} from './panel-layout';

export {
  LAYOUT_CONTAINER_CLASSES,
  LAYOUT_MAX_WIDTH_CLASSES,
  WIDGET_INFO,
  createDefaultTasksWidget,
  createDefaultEventsWidget,
  createDefaultChartWidget,
  createDefaultWidget,
  getPanelClasses,
  adjustPanelsForLayout as adjustPanelsForLayoutGeneric,
} from './panel-layout';

// Intake types
export type {
  IntakeStatus,
  Intake,
  IntakeComment,
  IntakeActivity,
  UpdateIntakeInput,
  SyncResult,
} from './intake';

export { INTAKE_STATUSES } from './intake';

// Template types
export type {
  CaseInfo,
  SigningAttorney,
  ExtractCaseInfoResponse,
} from './template';
