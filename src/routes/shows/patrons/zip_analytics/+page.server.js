// src/routes/shows/patrons/zip_analytics/+page.server.js
import sql from '$lib/db';

export const load = async ({ url }) => {
	const showCode = url.searchParams.get('show') || '';
	const year = url.searchParams.get('year') || '';

	try {
		// Build conditions for ticket-level filtering
		const conditions = [];
		if (showCode) conditions.push(sql`st.show_code = ${showCode}`);
		if (year) conditions.push(sql`EXTRACT(YEAR FROM st.show_date) = ${parseInt(year)}`);

		const ticketWhere = conditions.length > 0
			? sql`AND ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
			: sql``;

		// Zip code breakdown — count unique patrons and total tickets per zip
		const zipData = await sql`
			SELECT
				COALESCE(NULLIF(p.zip_code, ''), 'Unknown') AS zip_code,
				p.city,
				p.state,
				COUNT(DISTINCT p.patron_id)::int AS patron_count,
				COUNT(st.ticket_id)::int AS transaction_count,
				COALESCE(SUM(st.tickets_purchased), 0)::int AS tickets_sold,
				COALESCE(SUM(st.amount_paid), 0)::numeric AS revenue
			FROM patrons p
			JOIN show_tickets st ON st.patron_id = p.patron_id
			WHERE 1=1 ${ticketWhere}
			GROUP BY COALESCE(NULLIF(p.zip_code, ''), 'Unknown'), p.city, p.state
			ORDER BY patron_count DESC
		`;

		// Top-level stats
		const [stats] = await sql`
			SELECT
				COUNT(DISTINCT p.patron_id)::int AS total_patrons,
				COUNT(DISTINCT CASE WHEN p.zip_code IS NOT NULL AND p.zip_code != '' THEN p.patron_id END)::int AS patrons_with_zip,
				COUNT(DISTINCT COALESCE(NULLIF(p.zip_code, ''), 'Unknown')) AS unique_zips
			FROM patrons p
			JOIN show_tickets st ON st.patron_id = p.patron_id
			WHERE 1=1 ${ticketWhere}
		`;

		// Shows for filter dropdown
		const shows = await sql`
			SELECT show_code, show_name, format
			FROM shows ORDER BY format ASC, show_name ASC
		`;

		// Years for filter dropdown
		const years = await sql`
			SELECT DISTINCT EXTRACT(YEAR FROM show_date)::int AS year
			FROM show_tickets ORDER BY year DESC
		`;

		return {
			zipData: zipData.map((z) => ({
				...z,
				revenue: Number(z.revenue)
			})),
			stats: {
				...stats,
				unique_zips: Number(stats.unique_zips)
			},
			shows,
			years: years.map((y) => y.year),
			filters: { showCode, year }
		};
	} catch (error) {
		console.error('Error loading zip analytics:', error);
		return {
			zipData: [],
			stats: { total_patrons: 0, patrons_with_zip: 0, unique_zips: 0 },
			shows: [],
			years: [],
			filters: { showCode, year }
		};
	}
};