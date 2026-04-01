// src/routes/hsi/reports/classes/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'manager');
	try {
		const summaries = await sql`
			SELECT
				mcs.class_code,
				c.class_name,
				c.track,
				mcs.summary_month,
				EXTRACT(YEAR FROM mcs.summary_month)::integer AS summary_year,
				EXTRACT(MONTH FROM mcs.summary_month)::integer AS summary_month_num,
				mcs.registrations AS unit_count,
				mcs.revenue
			FROM monthly_class_summary mcs
			JOIN classes c ON c.class_code = mcs.class_code
			ORDER BY mcs.summary_month DESC, c.class_name
		`;

		const classes = await sql`
			SELECT class_code, class_name, track
			FROM classes
			WHERE is_active = true
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
			classes
		};
	} catch (error) {
		console.error('Error loading class reporting data:', error);
		return { summaries: [], classes: [] };
	}
};