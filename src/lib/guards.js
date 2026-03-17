// src/lib/guards.js
import { redirect } from '@sveltejs/kit';
import { hasPermission } from '$lib/auth';

/**
 * Require a minimum permission level for an area.
 * Use in +page.server.js load functions:
 *   import { requirePermission } from '$lib/guards';
 *   export const load = async ({ locals }) => {
 *       requirePermission(locals.user, 'hsi', 'data_entry');
 *       // ... rest of load
 *   };
 */
export function requirePermission(user, area, level = 'viewer') {
	if (!user) throw redirect(303, '/login');
	if (!hasPermission(user, area, level)) {
		throw redirect(303, '/?unauthorized=1');
	}
}

/**
 * Require super admin access
 */
export function requireSuperAdmin(user) {
	if (!user) throw redirect(303, '/login');
	if (!user.is_super_admin) {
		throw redirect(303, '/?unauthorized=1');
	}
}