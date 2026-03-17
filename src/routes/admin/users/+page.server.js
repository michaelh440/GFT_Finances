// src/routes/admin/users/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	if (!locals.user?.is_super_admin) {
		throw redirect(303, '/');
	}

	try {
		const users = await sql`
			SELECT user_id, email, first_name, last_name, display_name,
			       is_active, is_super_admin,
			       hsi_role, gft_role, csz_role, corp_role,
			       last_login_at, login_count, created_at
			FROM app_users
			ORDER BY is_super_admin DESC, last_name ASC, first_name ASC
		`;

		return {
			users: users.map((u) => ({
				...u,
				last_login_at: u.last_login_at ? u.last_login_at.toISOString() : null,
				created_at: u.created_at ? u.created_at.toISOString() : null
			}))
		};
	} catch (error) {
		console.error('Error loading users:', error);
		return { users: [] };
	}
};