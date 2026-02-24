/**
 * User avatar colors - re-exports from centralized config
 *
 * @deprecated Import from '@/config/colors' instead:
 * import { BADGE_PALETTE_KEYS, getBadgeColorClassesById } from '../config/colors';
 */

import { BADGE_PALETTE, BADGE_PALETTE_KEYS, colorToClasses } from '../config/colors';

/** @deprecated Use BADGE_PALETTE_KEYS and getBadgeColorById instead */
export const USER_AVATAR_COLORS = BADGE_PALETTE_KEYS.map((key) => BADGE_PALETTE[key]);

/**
 * Get consistent color classes for a user based on their ID.
 * @deprecated Use getBadgeColorClassesById from '../config/colors' instead
 */
export function getUserColorClass(userId: number): string {
  const color = USER_AVATAR_COLORS[userId % USER_AVATAR_COLORS.length];
  return colorToClasses(color);
}
