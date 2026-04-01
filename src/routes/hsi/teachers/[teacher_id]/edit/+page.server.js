// src/routes/hsi/teachers/[teacher_id]/edit/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'hsi', 'data_entry');
	const teacherId = parseInt(params.teacher_id);

	if (isNaN(teacherId)) {
		return { teacher: null };
	}

	try {
		const [teacher] = await sql`
			SELECT teacher_id, first_name, last_name, email, phone, bio, is_active
			FROM teachers
			WHERE teacher_id = ${teacherId}
		`;

		return { teacher: teacher || null };
	} catch (error) {
		console.error('Error loading teacher:', error);
		return { teacher: null };
	}
};

export const actions = {
	default: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const teacherId = parseInt(params.teacher_id);
		const formData = await request.formData();

		const firstName = (formData.get('first_name') || '').toString().trim();
		const lastName = (formData.get('last_name') || '').toString().trim();
		const email = (formData.get('email') || '').toString().trim() || null;
		const phone = (formData.get('phone') || '').toString().trim() || null;
		const bio = (formData.get('bio') || '').toString().trim() || null;
		const isActive = formData.get('is_active') === 'on';

		if (!firstName || !lastName) {
			return { success: false, error: 'First name and last name are required.' };
		}

		try {
			await sql`
				UPDATE teachers SET
					first_name = ${firstName},
					last_name = ${lastName},
					email = ${email},
					phone = ${phone},
					bio = ${bio},
					is_active = ${isActive},
					updated_at = CURRENT_TIMESTAMP
				WHERE teacher_id = ${teacherId}
			`;

			throw redirect(303, `/hsi/teachers/${teacherId}`);
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;
			if (/** @type {any} */ (err).code === '23505') {
				return { success: false, error: 'A teacher with this name and email already exists.' };
			}
			console.error('Error updating teacher:', err);
			return { success: false, error: 'Failed to update teacher: ' + (err instanceof Error ? err.message : String(err)) };
		}
	}
};