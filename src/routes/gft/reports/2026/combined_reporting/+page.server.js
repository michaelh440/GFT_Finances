// src/routes/reports/2026/combined_reporting/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		// Get combined monthly data from the view
		const summaries = await sql`
			SELECT
				source_type,
				item_code,
				item_name,
				category,
				source_label,
				summary_month,
				summary_year,
				summary_month_num,
				unit_count,
				revenue
			FROM monthly_combined_summary
			ORDER BY summary_month DESC, source_type, item_name
		`;

		// Get distinct items for filters
		const showItems = await sql`
			SELECT show_code AS item_code, show_name AS item_name, format AS category
			FROM shows WHERE is_active = true
			ORDER BY show_name
		`;

		const classItems = await sql`
			SELECT class_code AS item_code, class_name AS item_name, track AS category
			FROM classes WHERE is_active = true
			ORDER BY class_name
		`;

		return {
			summaries: summaries.map((s) => ({
				...s,
				summary_month: s.summary_month instanceof Date
					? s.summary_month.toISOString().split('T')[0]
					: String(s.summary_month || '').slice(0, 10),
				unit_count: Number(s.unit_count || 0),
				revenue: Number(s.revenue || 0),
				summary_year: Number(s.summary_year),
				summary_month_num: Number(s.summary_month_num)
			})),
			showItems,
			classItems
		};
	} catch (error) {
		console.error('Error loading combined reporting data:', error);
		return {
			summaries: [],
			showItems: [],
			classItems: []
		};
	}
};