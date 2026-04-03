// src/routes/gft/bar/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'gft', 'viewer');
	try {
		const barItems = await sql`
			SELECT
				item_code,
				item_name,
				category,
				is_active,
				created_at
			FROM bar_items
			ORDER BY
				is_active DESC,
				category ASC,
				item_name ASC
		`;

		return {
			barItems,
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading bar items:', error);
		return { barItems: [] };
	}
};
