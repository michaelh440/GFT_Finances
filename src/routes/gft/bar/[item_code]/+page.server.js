// src/routes/gft/bar/[item_code]/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'gft', 'viewer');
	const { item_code } = params;

	try {
		const [item] = await sql`
			SELECT
				item_code,
				item_name,
				category,
				is_active,
				created_at
			FROM bar_items
			WHERE item_code = ${item_code}
		`;

		if (!item) {
			return { item: null, summaries: [], totalUnits: 0, totalRevenue: 0 };
		}

		const summaries = await sql`
			SELECT
				item_code,
				summary_month,
				summary_year,
				units_sold,
				revenue,
				updated_at
			FROM monthly_bar_summary
			WHERE item_code = ${item_code}
			ORDER BY summary_month DESC
		`;

		const totalUnits = summaries.reduce((sum, s) => sum + Number(s.units_sold), 0);
		const totalRevenue = summaries.reduce((sum, s) => sum + Number(s.revenue), 0);

		return {
			item,
			summaries: summaries.map((s) => ({
				...s,
				units_sold: Number(s.units_sold),
				revenue: Number(s.revenue)
			})),
			totalUnits,
			totalRevenue,
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading bar item detail:', error);
		return { item: null, summaries: [], totalUnits: 0, totalRevenue: 0 };
	}
};

export const actions = {
	delete: async ({ params, locals }) => {
		requirePermission(locals.user, 'gft', 'data_entry');
		const { item_code } = params;

		try {
			// Delete summaries first (foreign key)
			await sql`DELETE FROM monthly_bar_summary WHERE item_code = ${item_code}`;
			await sql`DELETE FROM bar_items WHERE item_code = ${item_code}`;
		} catch (error) {
			console.error('Error deleting bar item:', error);
			return { success: false, error: 'Failed to delete item.' };
		}

		throw redirect(303, '/gft/bar');
	}
};
