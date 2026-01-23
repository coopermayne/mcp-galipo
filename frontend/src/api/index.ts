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
} from './cases';

// Tasks
export {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTask,
} from './tasks';

// Events
export {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
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
} from './persons';

// Activities (placeholder for future use)
export {} from './activities';

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
export { sendChatMessage, streamChatMessage } from './chat';
