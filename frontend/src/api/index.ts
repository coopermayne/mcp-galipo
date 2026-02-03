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

// Persons
export {
  getPersons,
  getPerson,
  createPerson,
  updatePerson,
  deletePerson,
  getCasePersons,
  assignPersonToCase,
  updateCaseAssignment,
  removePersonFromCase,
  getExpertiseTypes,
  createExpertiseType,
  getPersonTypes,
  createPersonType,
  updatePersonType,
  deletePersonType,
} from './persons';

// Activities
export { createActivity, deleteActivity } from './activities';

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

// Chat
export { streamChatMessage } from './chat';

// Quick Create
export { quickCreateTask, quickCreateEvent } from './quickCreate';

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
} from './users';
