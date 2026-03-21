// src/routes/admin/users/new/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import { createUser, auditLog } from '$lib/auth';

/** @param {any} event */
export const load = async ({ locals }) => {
	if (!locals.user?.is_super_admin) {
		throw redirect(303, '/');
	}
	return { editUser: null, isNew: true };
};

export const actions = {
	/** @param {any} event */
	default: async ({ request, locals, getClientAddress }) => {
		if (!locals.user?.is_super_admin) {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();

		const email = formData.get('email')?.toString().trim() || '';
		const firstName = formData.get('first_name')?.toString().trim() || '';
		const lastName = formData.get('last_name')?.toString().trim() || '';
		const displayName = formData.get('display_name')?.toString().trim() || '';
		const password = formData.get('password')?.toString() || '';
		const isSuperAdmin = formData.get('is_super_admin') === 'true';
		const hsiRole = formData.get('hsi_role')?.toString() || 'none';
		const gftRole = formData.get('gft_role')?.toString() || 'none';
		const cszRole = formData.get('csz_role')?.toString() || 'none';
		const corpRole = formData.get('corp_role')?.toString() || 'none';

		const values = { email, first_name: firstName, last_name: lastName, display_name: displayName, is_super_admin: isSuperAdmin, hsi_role: hsiRole, gft_role: gftRole, csz_role: cszRole, corp_role: corpRole };

		if (!email || !firstName || !lastName) {
			return fail(400, { error: 'Email, first name, and last name are required.', values });
		}
		if (!password) {
			return fail(400, { error: 'Password is required for new users.', values });
		}
		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.', values });
		}

		try {
			const user = await createUser({
				email, password, firstName, lastName, displayName,
				isSuperAdmin, hsiRole, gftRole, cszRole, corpRole,
				createdBy: locals.user.user_id
			});

			await auditLog({
				userId: locals.user.user_id,
				userEmail: locals.user.email,
				action: 'create',
				tableName: 'app_users',
				recordId: user.user_id,
				details: { email, roles: { hsiRole, gftRole, cszRole, corpRole }, isSuperAdmin },
				ipAddress: getClientAddress()
			});

			throw redirect(303, '/admin/users');
		} catch (/** @type {any} */ error) {
			if (error?.status === 303) throw error;
			if (error?.code === '23505') {
				return fail(400, { error: 'A user with that email already exists.', values });
			}
			console.error('Error creating user:', error);
			return fail(500, { error: 'An unexpected error occurred.', values });
		}
	}
};