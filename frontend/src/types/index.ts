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
