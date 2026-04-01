// src/routes/shows/new/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'gft', 'data_entry');
		const formData = await request.formData();

		const show_code = (formData.get('show_code') || '').toString().trim().toUpperCase();
		const show_name = (formData.get('show_name') || '').toString().trim();
		const format = (formData.get('format') || '').toString().trim() || null;
		const audience_type = (formData.get('audience_type') || '').toString() || null;
		const day_of_week = (formData.get('day_of_week') || '').toString() || null;
		const standard_ticket_price = parseFloat(formData.get('standard_ticket_price')?.toString() || '0');
		const description = (formData.get('description') || '').toString().trim() || null;

		const values = { show_code, show_name, format, audience_type, day_of_week, standard_ticket_price, description };

		// Validation
		if (!show_code) {
			return fail(400, { error: 'Show code is required.', values });
		}

		if (!/^[A-Z0-9_-]+$/.test(show_code)) {
			return fail(400, { error: 'Show code must contain only letters, numbers, hyphens, and underscores.', values });
		}

		if (!show_name) {
			return fail(400, { error: 'Show name is required.', values });
		}

		if (isNaN(standard_ticket_price) || standard_ticket_price < 0) {
			return fail(400, { error: 'Ticket price must be a valid non-negative number.', values });
		}

		try {
			await sql`
				INSERT INTO shows (show_code, show_name, format, audience_type, day_of_week, standard_ticket_price, description)
				VALUES (${show_code}, ${show_name}, ${format}, ${audience_type}, ${day_of_week}, ${standard_ticket_price}, ${description})
			`;
		} catch (error) {
			console.error('Error creating show:', error);

			if (/** @type {any} */ (error).code === '23505') {
				const detail = /** @type {any} */ (error).detail || '';
				if (detail.includes('show_code')) {
					return fail(400, { error: `A show with code "${show_code}" already exists.`, values });
				}
				return fail(400, { error: 'A show with that name already exists.', values });
			}

			return fail(500, { error: 'An unexpected error occurred. Please try again.', values });
		}

		throw redirect(303, `/gft/shows/${show_code}`);
	}
};