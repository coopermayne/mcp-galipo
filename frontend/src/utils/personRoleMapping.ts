// Map roles to person types for autocomplete filtering
// When adding a person with a specific role, we filter existing persons by these types

import type { PersonType } from '../types';

export const roleToPersonTypes: Record<string, PersonType[]> = {
  // Client-related roles
  'Client': ['client'],
  'Guardian Ad Litem': ['client', 'attorney'],
  'Plaintiff Contact': ['client'],

  // Defendant roles
  'Defendant': ['defendant'],

  // Attorney roles
  'Opposing Counsel': ['attorney'],
  'Co-Counsel': ['attorney'],
  'Referring Attorney': ['attorney'],

  // Court roles
  'Judge': ['judge'],
  'Magistrate Judge': ['judge'],

  // Expert roles
  'Expert - Plaintiff': ['expert'],
  'Expert - Defendant': ['expert'],

  // Other professional roles
  'Mediator': ['mediator'],
  'Interpreter': ['interpreter'],

  // Could be various person types
  'Witness': ['client', 'defendant', 'witness'],
  'Insurance Adjuster': ['insurance_adjuster', 'attorney'],
  'Lien Holder': ['lien_holder', 'medical_provider'],
};

/**
 * Get person types to filter by for a given role.
 * Returns undefined if role is not mapped (allow all types).
 */
export function getPersonTypesForRole(role: string): PersonType[] | undefined {
  return roleToPersonTypes[role];
}

/**
 * Infer person type from role when creating a new person.
 * Returns the most likely type for the role.
 */
export function inferPersonTypeFromRole(role: string): PersonType {
  const types = roleToPersonTypes[role];
  if (types && types.length > 0) {
    return types[0];
  }
  // Default fallbacks based on role keywords
  if (role.includes('Expert')) return 'expert';
  if (role.includes('Judge')) return 'judge';
  if (role.includes('Counsel') || role.includes('Attorney')) return 'attorney';
  return 'client'; // Default
}

/**
 * Infer side from role.
 */
export function inferSideFromRole(role: string): 'plaintiff' | 'defendant' | 'neutral' {
  if (role === 'Client' || role === 'Plaintiff Contact' || role === 'Guardian Ad Litem') return 'plaintiff';
  if (role === 'Defendant') return 'defendant';
  if (role === 'Opposing Counsel') return 'defendant';
  if (role === 'Co-Counsel' || role === 'Referring Attorney') return 'plaintiff';
  if (role.includes('Plaintiff')) return 'plaintiff';
  if (role.includes('Defendant')) return 'defendant';
  return 'neutral';
}
