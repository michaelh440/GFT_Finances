// src/routes/shows/patrons/new/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const first_name = formData.get('first_name')?.toString().trim();
		const last_name = formData.get('last_name')?.toString().trim();
		const email = formData.get('email')?.toString().trim() || null;
		const phone = formData.get('phone')?.toString().trim() || null;

		if (!first_name || !last_name) {
			return fail(400, {
				error: 'First name and last name are required.',
				values: { first_name, last_name, email, phone }
			});
		}

		try {
			const [newPatron] = await sql`
				INSERT INTO patrons (first_name, last_name, email, phone)
				VALUES (${first_name}, ${last_name}, ${email}, ${phone})
				RETURNING patron_id
			`;

			throw redirect(303, `/gft/patrons/${newPatron.patron_id}`);
		} catch (error) {
			if (/** @type {any} */ (error).status === 303) throw error;

			console.error('Error creating patron:', error);

			if (/** @type {any} */ (error).code === '23505') {
				return fail(400, {
					error: 'A patron with that name and email already exists.',
					values: { first_name, last_name, email, phone }
				});
			}

			return fail(500, {
				error: 'An unexpected error occurred. Please try again.',
				values: { first_name, last_name, email, phone }
			});
		}
	}
};