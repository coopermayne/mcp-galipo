// Barrel export for API modules
// Re-exports all API functions for backwards compatibility with '@/api/client' imports

// Common utilities and error class
export { ApiError, API_BASE, request } from './common';

// Stats and constants
export {
  getStats,
  getConstants,
  getJurisdictions,
  createJurisdiction,
  updateJurisdiction,
} from './stats';

// Cases
export {
  getCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  getCaseUsers,
  assignAttorneyToCase,
  removeAttorneyFromCase,
  assignParalegalToCase,
  removeParalegalFromCase,
} from './cases';

// Tasks
export {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTask,
  rescheduleOverdueTasks,
} from './tasks';

// Events
export {
  getEvent,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventTasks,
  searchEvents,
} from './events';

// Notes
export {
  createNote,
  updateNote,
  deleteNote,
} from './notes';

// Roles
export {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
} from './roles';

// Judges
export {
  getJudges,
  searchJudges,
  getJudge,
  createJudge,
  updateJudge,
  deleteJudge,
} from './judges';

// Persons
export {
  getPersons,
  getPerson,
  createPerson,
  updatePerson,
  deletePerson,
  archivePerson,
  getCasePersons,
  assignPersonToCase,
  updateCaseAssignment,
  changePersonRole,
  removePersonFromCase,
  getExpertiseTypes,
  createExpertiseType,
  getDuplicatePersons,
  getMergePreview,
  mergePersons,
} from './persons';
export type { DuplicateGroup } from './persons';

// Proceedings
export {
  getProceedings,
  getProceeding,
  createProceeding,
  updateProceeding,
  deleteProceeding,
  // Proceeding judges
  getProceedingJudges,
  addProceedingJudge,
  updateProceedingJudge,
  removeProceedingJudge,
} from './proceedings';

// Export
export { exportCaseListPdf, exportCaseListDocx } from './export';

// Chat
export { streamChatMessage } from './chat';

// Webhooks
export { getWebhooks, getWebhook, deleteWebhook } from './webhooks';
export type { WebhookLog, GetWebhooksParams } from './webhooks';

// Users
export {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getUserCases,
  getAttorneys,
  getStaff,
} from './users';
export type { AttorneyRef, StaffRef } from './users';

// Templates
export { extractCaseInfo } from './templates';

// RFP
export { extractRFP, analyzeRFPRequests, generateRFPResponse } from './rfp';

// Objections
export { getObjections, createObjection, updateObjection, deleteObjection, reorderObjections } from './objections';

// Intakes
export { getIntakes, getIntakeCounts, getIntake, updateIntake, deleteIntake, syncIntakes, analyzeIntakes } from './intakes';
