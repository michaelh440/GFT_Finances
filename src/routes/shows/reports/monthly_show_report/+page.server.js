// src/routes/shows/reports/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const summaries = await sql`
			SELECT
				mss.show_code,
				s.show_name,
				s.format,
				mss.summary_month,
				EXTRACT(YEAR FROM mss.summary_month)::integer AS summary_year,
				EXTRACT(MONTH FROM mss.summary_month)::integer AS summary_month_num,
				mss.tickets_sold AS unit_count,
				mss.revenue
			FROM monthly_show_summary mss
			JOIN shows s ON s.show_code = mss.show_code
			ORDER BY mss.summary_month DESC, s.show_name
		`;

		const shows = await sql`
			SELECT show_code, show_name, format
			FROM shows
			WHERE is_active = true
			ORDER BY show_name
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
			shows
		};
	} catch (error) {
		console.error('Error loading show reporting data:', error);
		return { summaries: [], shows: [] };
	}
};