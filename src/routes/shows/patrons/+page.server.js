// src/routes/shows/patrons/+page.server.js
import sql from '$lib/db';

const PAGE_SIZE = 50;

export const load = async ({ url }) => {
	const search = url.searchParams.get('search') || '';
	const currentPage = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const showCode = url.searchParams.get('show') || '';
	const format = url.searchParams.get('format') || '';
	const audienceType = url.searchParams.get('audience') || '';
	const dayOfWeek = url.searchParams.get('day') || '';
	const yearsParam = url.searchParams.get('years') || '';
	const selectedYears = yearsParam.split(',').filter(Boolean).map(y => parseInt(y)).filter(y => !isNaN(y));

	try {
		// Build conditions — same pattern as geo analytics
		const conditions = [];
		if (showCode) conditions.push(sql`st.show_code = ${showCode}`);
		if (format) conditions.push(sql`s.format = ${format}`);
		if (audienceType) conditions.push(sql`s.audience_type = ${audienceType}`);
		if (dayOfWeek) conditions.push(sql`s.day_of_week = ${dayOfWeek}`);
		if (selectedYears.length > 0) conditions.push(sql`EXTRACT(YEAR FROM st.purchase_date)::int IN ${sql(selectedYears)}`);

		const ticketWhere = conditions.length > 0
			? sql`AND ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
			: sql``;

		const searchWhere = search
			? sql`AND (
				LOWER(p.first_name) LIKE ${`%${search.toLowerCase()}%`}
				OR LOWER(p.last_name) LIKE ${`%${search.toLowerCase()}%`}
				OR LOWER(p.email) LIKE ${`%${search.toLowerCase()}%`}
			)`
			: sql``;

		// Count
		const [countResult] = await sql`
			SELECT COUNT(DISTINCT p.patron_id)::int AS total
			FROM patrons p
			JOIN show_tickets st ON st.patron_id = p.patron_id
			JOIN shows s ON s.show_code = st.show_code
			WHERE 1=1 ${ticketWhere} ${searchWhere}
		`;
		const totalCount = countResult.total;
		const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
		const safePage = Math.min(currentPage, totalPages);
		const offset = (safePage - 1) * PAGE_SIZE;

		// Patrons list
		const patrons = await sql`
			SELECT 
				p.patron_id,
				p.first_name,
				p.last_name,
				p.email,
				p.phone,
				p.is_active,
				p.created_at,
				COUNT(st.ticket_id)::int AS purchase_count,
				COALESCE(SUM(st.tickets_purchased), 0)::int AS total_tickets,
				COALESCE(SUM(st.amount_paid), 0)::numeric AS total_spent
			FROM patrons p
			JOIN show_tickets st ON st.patron_id = p.patron_id
			JOIN shows s ON s.show_code = st.show_code
			WHERE 1=1 ${ticketWhere} ${searchWhere}
			GROUP BY p.patron_id, p.first_name, p.last_name, p.email, p.phone, p.is_active, p.created_at
			ORDER BY p.last_name ASC, p.first_name ASC
			LIMIT ${PAGE_SIZE}
			OFFSET ${offset}
		`;

		// Stats — scoped to ticket filters (not search)
		const [stats] = await sql`
			SELECT
				COUNT(DISTINCT p.patron_id)::int AS total_patrons,
				COUNT(DISTINCT CASE 
					WHEN (
						SELECT COUNT(*) FROM show_tickets st2 
						JOIN shows s2 ON s2.show_code = st2.show_code
						WHERE st2.patron_id = p.patron_id AND 1=1 ${ticketWhere}
					) > 1 THEN p.patron_id 
				END)::int AS repeat_patrons,
				COUNT(DISTINCT st.ticket_id)::int AS total_transactions,
				COALESCE(SUM(st.tickets_purchased), 0)::int AS total_tickets,
				COALESCE(SUM(st.amount_paid), 0)::numeric AS total_revenue
			FROM patrons p
			JOIN show_tickets st ON st.patron_id = p.patron_id
			JOIN shows s ON s.show_code = st.show_code
			WHERE 1=1 ${ticketWhere}
		`;

		// Anonymous stats (tickets with no patron)
		const [anonStats] = await sql`
			SELECT
				COUNT(DISTINCT st.ticket_id)::int AS anonymous_transactions,
				COALESCE(SUM(st.tickets_purchased), 0)::int AS anonymous_tickets,
				COALESCE(SUM(st.amount_paid), 0)::numeric AS anonymous_revenue
			FROM show_tickets st
			JOIN shows s ON s.show_code = st.show_code
			WHERE st.patron_id IS NULL AND 1=1 ${ticketWhere}
		`;

		// Filter dropdown data
		const shows = await sql`
			SELECT show_code, show_name, format, audience_type, day_of_week
			FROM shows WHERE is_active = true
			ORDER BY show_name ASC
		`;

		const formats = await sql`
			SELECT DISTINCT format FROM shows 
			WHERE format IS NOT NULL AND format != '' AND is_active = true
			ORDER BY format ASC
		`;

		const audiences = await sql`
			SELECT DISTINCT audience_type FROM shows 
			WHERE audience_type IS NOT NULL AND audience_type != '' AND is_active = true
			ORDER BY audience_type ASC
		`;

		const days = await sql`
			SELECT day_of_week FROM (
				SELECT DISTINCT day_of_week FROM shows 
				WHERE day_of_week IS NOT NULL AND day_of_week != '' AND is_active = true
			) d
			ORDER BY CASE day_of_week
				WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
				WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
				WHEN 'Sunday' THEN 7 ELSE 8
			END
		`;

		const years = await sql`
			SELECT DISTINCT EXTRACT(YEAR FROM purchase_date)::int AS year
			FROM show_tickets
			WHERE purchase_date IS NOT NULL
			ORDER BY year DESC
		`;

		return {
			patrons: patrons.map((p) => ({
				...p,
				purchase_count: Number(p.purchase_count),
				total_tickets: Number(p.total_tickets),
				total_spent: Number(p.total_spent)
			})),
			stats: {
				totalPatrons: stats.total_patrons,
				repeatPatrons: stats.repeat_patrons,
				totalTransactions: stats.total_transactions,
				totalTickets: Number(stats.total_tickets),
				totalRevenue: Number(stats.total_revenue),
				anonymousTransactions: anonStats.anonymous_transactions,
				anonymousTickets: Number(anonStats.anonymous_tickets),
				anonymousRevenue: Number(anonStats.anonymous_revenue)
			},
			pagination: {
				currentPage: safePage,
				totalPages,
				pageSize: PAGE_SIZE,
				totalCount
			},
			search,
			shows,
			formats: formats.map(f => f.format),
			audiences: audiences.map(a => a.audience_type),
			days: days.map(d => d.day_of_week),
			years: years.map(y => y.year),
			filters: { showCode, format, audienceType, dayOfWeek, years: yearsParam }
		};
	} catch (error) {
		console.error('Error loading patrons:', error);
		return {
			patrons: [],
			stats: { totalPatrons: 0, repeatPatrons: 0, totalTransactions: 0, totalTickets: 0, totalRevenue: 0, anonymousTransactions: 0, anonymousTickets: 0, anonymousRevenue: 0 },
			pagination: { currentPage: 1, totalPages: 1, pageSize: PAGE_SIZE, totalCount: 0 },
			search,
			shows: [], formats: [], audiences: [], days: [], years: [],
			filters: { showCode: '', format: '', audienceType: '', dayOfWeek: '', years: '' }
		};
	}
};