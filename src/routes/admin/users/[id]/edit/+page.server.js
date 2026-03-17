// src/routes/admin/users/[user_id]/edit/+page.server.js
// Also used for /admin/users/new with user_id = 'new'
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import { createUser, changePassword, auditLog } from '$lib/auth';

export const load = async ({ locals, params }) => {
	if (!locals.user?.is_super_admin) {
		throw redirect(303, '/');
	}

	const isNew = params.user_id === 'new';
	if (isNew) return { editUser: null, isNew: true };

	const userId = parseInt(params.user_id);
	if (isNaN(userId)) throw redirect(303, '/admin/users');

	try {
		const [editUser] = await sql`
			SELECT user_id, email, first_name, last_name, display_name,
			       is_active, is_super_admin,
			       hsi_role, gft_role, csz_role, corp_role
			FROM app_users
			WHERE user_id = ${userId}
		`;

		if (!editUser) throw redirect(303, '/admin/users');
		return { editUser, isNew: false };
	} catch (error) {
		if (error?.status === 303) throw error;
		console.error('Error loading user:', error);
		throw redirect(303, '/admin/users');
	}
};

export const actions = {
	default: async ({ request, params, locals, getClientAddress }) => {
		if (!locals.user?.is_super_admin) {
			return fail(403, { error: 'Unauthorized' });
		}

		const isNew = params.user_id === 'new';
		const formData = await request.formData();

		const email = formData.get('email')?.toString().trim() || '';
		const firstName = formData.get('first_name')?.toString().trim() || '';
		const lastName = formData.get('last_name')?.toString().trim() || '';
		const displayName = formData.get('display_name')?.toString().trim() || '';
		const password = formData.get('password')?.toString() || '';
		const isSuperAdmin = formData.get('is_super_admin') === 'true';
		const isActive = formData.get('is_active') !== 'false';
		const hsiRole = formData.get('hsi_role')?.toString() || 'none';
		const gftRole = formData.get('gft_role')?.toString() || 'none';
		const cszRole = formData.get('csz_role')?.toString() || 'none';
		const corpRole = formData.get('corp_role')?.toString() || 'none';

		const values = { email, first_name: firstName, last_name: lastName, display_name: displayName, is_super_admin: isSuperAdmin, is_active: isActive, hsi_role: hsiRole, gft_role: gftRole, csz_role: cszRole, corp_role: corpRole };

		// Validation
		if (!email || !firstName || !lastName) {
			return fail(400, { error: 'Email, first name, and last name are required.', values });
		}
		if (isNew && !password) {
			return fail(400, { error: 'Password is required for new users.', values });
		}
		if (password && password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.', values });
		}

		try {
			if (isNew) {
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
			} else {
				const userId = parseInt(params.user_id);

				await sql`
					UPDATE app_users
					SET email = ${email.toLowerCase()},
					    first_name = ${firstName},
					    last_name = ${lastName},
					    display_name = ${displayName || `${firstName} ${lastName}`},
					    is_super_admin = ${isSuperAdmin},
					    is_active = ${isActive},
					    hsi_role = ${hsiRole},
					    gft_role = ${gftRole},
					    csz_role = ${cszRole},
					    corp_role = ${corpRole},
					    updated_at = CURRENT_TIMESTAMP
					WHERE user_id = ${userId}
				`;

				// Update password if provided
				if (password) {
					await changePassword(userId, password);
				}

				await auditLog({
					userId: locals.user.user_id,
					userEmail: locals.user.email,
					action: 'update',
					tableName: 'app_users',
					recordId: userId,
					details: { email, roles: { hsiRole, gftRole, cszRole, corpRole }, isSuperAdmin, isActive, passwordChanged: !!password },
					ipAddress: getClientAddress()
				});

				throw redirect(303, '/admin/users');
			}
		} catch (error) {
			if (error?.status === 303) throw error;

			if (error?.code === '23505') {
				return fail(400, { error: 'A user with that email already exists.', values });
			}

			console.error('Error saving user:', error);
			return fail(500, { error: 'An unexpected error occurred.', values });
		}
	}
};