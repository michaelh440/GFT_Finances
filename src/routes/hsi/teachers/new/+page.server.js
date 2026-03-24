// src/routes/hsi/teachers/new/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'data_entry');
	return { user: locals.user };
};

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const formData = await request.formData();

		const firstName = (formData.get('first_name') || '').toString().trim();
		const lastName = (formData.get('last_name') || '').toString().trim();
		const email = (formData.get('email') || '').toString().trim() || null;
		const phone = (formData.get('phone') || '').toString().trim() || null;
		const bio = (formData.get('bio') || '').toString().trim() || null;

		if (!firstName || !lastName) {
			return { success: false, error: 'First name and last name are required.' };
		}

		try {
			const [newTeacher] = await sql`
				INSERT INTO teachers (first_name, last_name, email, phone, bio)
				VALUES (${firstName}, ${lastName}, ${email}, ${phone}, ${bio})
				RETURNING teacher_id
			`;

			throw redirect(303, `/hsi/teachers/${newTeacher.teacher_id}`);
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;
			if (/** @type {any} */ (err).code === '23505') {
				return { success: false, error: 'A teacher with this name and email already exists.' };
			}
			console.error('Error creating teacher:', err);
			return { success: false, error: 'Failed to create teacher: ' + (err instanceof Error ? err.message : String(err)) };
		}
	}
};