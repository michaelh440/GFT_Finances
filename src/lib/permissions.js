// src/lib/permissions.js
// Pure permission helpers — safe to import in both server and client code.
// No database calls, no Node.js-only imports.

/** @type {string[]} */
export const LEVELS = ['none', 'viewer', 'data_entry', 'manager'];

/** @type {string[]} */
export const AREAS = ['hsi', 'gft', 'csz', 'corp'];

/**
 * Check if a user has at least the required level for an area.
 * Super admins always pass.
 * @param {any} user
 * @param {string} area
 * @param {string} requiredLevel
 * @returns {boolean}
 */
export function hasPermission(user, area, requiredLevel = 'viewer') {
  if (!user) return false;
  if (user.is_super_admin) return true;
  if (!AREAS.includes(area)) return false;
  const userLevel = user[`${area}_role`] || 'none';
  return LEVELS.indexOf(userLevel) >= LEVELS.indexOf(requiredLevel);
}

/**
 * Shorthand helpers
 * @param {any} user
 * @param {string} area
 */
export const canView      = (user, area) => hasPermission(user, area, 'viewer');
export const canDataEntry = (user, area) => hasPermission(user, area, 'data_entry');
export const canManage    = (user, area) => hasPermission(user, area, 'manager');