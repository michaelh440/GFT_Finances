// src/routes/gft/bar/[item_code]/edit/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'gft', 'data_entry');
	const { item_code } = params;

	try {
		const [item] = await sql`
			SELECT item_code, item_name, category, is_active
			FROM bar_items
			WHERE item_code = ${item_code}
		`;

		if (!item) {
			return { item: null };
		}

		return { item };
	} catch (error) {
		console.error('Error loading bar item for edit:', error);
		return { item: null };
	}
};

export const actions = {
	default: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'gft', 'data_entry');
		const { item_code } = params;
		const formData = await request.formData();

		const item_name = formData.get('item_name')?.toString().trim();
		const category = formData.get('category')?.toString().trim() || 'Other';
		const is_active = formData.get('is_active') === 'true';

		const values = { item_name, category, is_active };

		if (!item_name) {
			return fail(400, { error: 'Item name is required.', values });
		}

		try {
			await sql`
				UPDATE bar_items
				SET
					item_name = ${item_name},
					category = ${category},
					is_active = ${is_active}
				WHERE item_code = ${item_code}
			`;
		} catch (error) {
			console.error('Error updating bar item:', error);
			return fail(500, { error: 'An unexpected error occurred. Please try again.', values });
		}

		throw redirect(303, `/gft/bar/${item_code}`);
	}
};
