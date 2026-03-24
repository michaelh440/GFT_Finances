// src/routes/shows/patrons/[patron_id]/edit/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';

export const load = async ({ params }) => {
	const { patron_id } = params;

	try {
		const [patron] = await sql`
			SELECT patron_id, first_name, last_name, email, phone, is_active
			FROM patrons
			WHERE patron_id = ${patron_id}
		`;

		if (!patron) {
			return { patron: null };
		}

		return { patron };
	} catch (error) {
		console.error('Error loading patron for edit:', error);
		return { patron: null };
	}
};

export const actions = {
	default: async ({ request, params }) => {
		const { patron_id } = params;
		const formData = await request.formData();

		const first_name = formData.get('first_name')?.toString().trim();
		const last_name = formData.get('last_name')?.toString().trim();
		const email = formData.get('email')?.toString().trim() || null;
		const phone = formData.get('phone')?.toString().trim() || null;
		const is_active = formData.get('is_active') === 'true';

		if (!first_name || !last_name) {
			return fail(400, {
				error: 'First name and last name are required.',
				values: { first_name, last_name, email, phone, is_active }
			});
		}

		try {
			await sql`
				UPDATE patrons
				SET
					first_name = ${first_name},
					last_name = ${last_name},
					email = ${email},
					phone = ${phone},
					is_active = ${is_active},
					updated_at = CURRENT_TIMESTAMP
				WHERE patron_id = ${patron_id}
			`;
		} catch (error) {
			console.error('Error updating patron:', error);

			if (/** @type {any} */ (error).code === '23505') {
				return fail(400, {
					error: 'A patron with that name and email already exists.',
					values: { first_name, last_name, email, phone, is_active }
				});
			}

			return fail(500, {
				error: 'An unexpected error occurred. Please try again.',
				values: { first_name, last_name, email, phone, is_active }
			});
		}

		throw redirect(303, `/gft/patrons/${patron_id}`);
	}
};