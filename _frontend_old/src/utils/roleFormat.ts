/**
 * Role name formatting utilities
 * Converts database snake_case names to human-friendly display names
 */

// Map of role names to display names (override defaults)
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  guardian_ad_litem: 'Guardian Ad Litem',
  co_counsel: 'Co-Counsel',
  plaintiff_expert: 'Plaintiff Expert',
  defense_expert: 'Defense Expert',
  referring_attorney: 'Referring Attorney',
  opposing_counsel: 'Opposing Counsel',
  municipality_defendant: 'Municipality',
  individual_defendant: 'Individual',
  lien_holder: 'Lien Holder',
};

// Map of category names to display names
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  expert: 'Experts',
  counsel: 'Counsel',
  mediator: 'Mediator',
  client: 'Clients',
  defendant: 'Defendants',
  other: 'Other',
};

/**
 * Convert a snake_case role name to a human-friendly display name
 */
export function formatRoleName(name: string): string {
  // Check for explicit override
  if (ROLE_DISPLAY_NAMES[name]) {
    return ROLE_DISPLAY_NAMES[name];
  }

  // Default: convert snake_case to Title Case
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Convert a category name to a human-friendly display name
 */
export function formatCategoryName(category: string): string {
  if (CATEGORY_DISPLAY_NAMES[category]) {
    return CATEGORY_DISPLAY_NAMES[category];
  }

  // Default: capitalize first letter
  return category.charAt(0).toUpperCase() + category.slice(1);
}
