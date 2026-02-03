/**
 * Shared color utility for user avatars/initials
 *
 * Provides consistent colors across UserChip, AssigneeBadge,
 * AssigneePicker, and AssigneeFilterDropdown.
 */

export const USER_AVATAR_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
  { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
];

/**
 * Get consistent color classes for a user based on their ID.
 * Returns both bg and text classes as a single string.
 */
export function getUserColorClass(userId: number): string {
  const color = USER_AVATAR_COLORS[userId % USER_AVATAR_COLORS.length];
  return `${color.bg} ${color.text}`;
}
