// src/routes/gft/bar/new/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'gft', 'data_entry');
		const formData = await request.formData();

		const item_code = (formData.get('item_code') || '').toString().trim().toUpperCase();
		const item_name = (formData.get('item_name') || '').toString().trim();
		const category = (formData.get('category') || '').toString().trim() || 'Other';

		const values = { item_code, item_name, category };

		if (!item_code) {
			return fail(400, { error: 'Item code is required.', values });
		}

		if (!/^[A-Z0-9_-]+$/.test(item_code)) {
			return fail(400, { error: 'Item code must contain only letters, numbers, hyphens, and underscores.', values });
		}

		if (!item_name) {
			return fail(400, { error: 'Item name is required.', values });
		}

		try {
			await sql`
				INSERT INTO bar_items (item_code, item_name, category)
				VALUES (${item_code}, ${item_name}, ${category})
			`;
		} catch (error) {
			console.error('Error creating bar item:', error);

			if (/** @type {any} */ (error).code === '23505') {
				return fail(400, { error: `A bar item with code "${item_code}" already exists.`, values });
			}

			return fail(500, { error: 'An unexpected error occurred. Please try again.', values });
		}

		throw redirect(303, `/gft/bar/${item_code}`);
	}
};
