// src/routes/shows/ticket_purchases/+page.server.js
import sql from '$lib/db';

const PAGE_SIZE = 50;

export const load = async ({ url }) => {
	// Read filter params from URL
	const showCode = url.searchParams.get('show') || '';
	const year = url.searchParams.get('year') || '';
	const dateFrom = url.searchParams.get('from') || '';
	const dateTo = url.searchParams.get('to') || '';
	const patronSearch = url.searchParams.get('patron') || '';
	const paymentMethod = url.searchParams.get('payment') || '';
	const currentPage = Math.max(1, parseInt(url.searchParams.get('page') || '1'));

	try {
		// Build dynamic WHERE clause with filters
		const conditions = [];

		if (showCode) {
			conditions.push(sql`st.show_code = ${showCode}`);
		}
		if (year) {
			conditions.push(sql`EXTRACT(YEAR FROM st.show_date) = ${parseInt(year)}`);
		}
		if (dateFrom) {
			conditions.push(sql`st.show_date >= ${dateFrom}::date`);
		}
		if (dateTo) {
			conditions.push(sql`st.show_date <= ${dateTo}::date`);
		}
		if (patronSearch) {
			const term = `%${patronSearch.toLowerCase()}%`;
			conditions.push(sql`(
				LOWER(p.first_name) LIKE ${term}
				OR LOWER(p.last_name) LIKE ${term}
				OR LOWER(p.email) LIKE ${term}
			)`);
		}
		if (paymentMethod) {
			conditions.push(sql`st.payment_method = ${paymentMethod}`);
		}

		const whereClause = conditions.length > 0
			? sql`WHERE ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
			: sql``;

		// Aggregate stats for the FULL filtered set (not paged)
		const [stats] = await sql`
			SELECT
				COUNT(*)::int AS total_count,
				COALESCE(SUM(st.tickets_purchased), 0)::int AS total_tickets,
				COALESCE(SUM(st.amount_paid), 0)::numeric AS total_revenue,
				COUNT(*) FILTER (WHERE st.patron_id IS NULL)::int AS anonymous_count
			FROM show_tickets st
			LEFT JOIN patrons p ON p.patron_id = st.patron_id
			${whereClause}
		`;

		const totalCount = stats.total_count;
		const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
		const safePage = Math.min(currentPage, totalPages);
		const offset = (safePage - 1) * PAGE_SIZE;

		// Fetch only the current page of data
		const tickets = await sql`
			SELECT 
				st.ticket_id,
				st.patron_id,
				st.show_code,
				st.show_date,
				st.tickets_purchased,
				st.amount_paid,
				st.purchase_date,
				st.payment_method,
				st.notes,
				s.show_name,
				s.format,
				p.first_name AS patron_first_name,
				p.last_name AS patron_last_name,
				p.email AS patron_email
			FROM show_tickets st
			JOIN shows s ON s.show_code = st.show_code
			LEFT JOIN patrons p ON p.patron_id = st.patron_id
			${whereClause}
			ORDER BY st.show_date DESC, st.purchase_date DESC
			LIMIT ${PAGE_SIZE}
			OFFSET ${offset}
		`;

		// Load shows list for filter dropdown
		const shows = await sql`
			SELECT show_code, show_name, format
			FROM shows
			ORDER BY format ASC, show_name ASC
		`;

		// Load available years for filter
		const years = await sql`
			SELECT DISTINCT EXTRACT(YEAR FROM show_date)::int AS year
			FROM show_tickets
			ORDER BY year DESC
		`;

		// Load payment methods for filter
		const paymentMethods = await sql`
			SELECT DISTINCT payment_method
			FROM show_tickets
			WHERE payment_method IS NOT NULL AND payment_method != ''
			ORDER BY payment_method ASC
		`;

		return {
			tickets: tickets.map((t) => ({
				...t,
				tickets_purchased: Number(t.tickets_purchased),
				amount_paid: Number(t.amount_paid)
			})),
			totalTickets: Number(stats.total_tickets),
			totalRevenue: Number(stats.total_revenue),
			anonymousCount: stats.anonymous_count,
			transactionCount: totalCount,
			pagination: {
				currentPage: safePage,
				totalPages,
				pageSize: PAGE_SIZE,
				totalCount
			},
			shows,
			years: years.map((y) => y.year),
			paymentMethods: paymentMethods.map((p) => p.payment_method),
			filters: { showCode, year, dateFrom, dateTo, patronSearch, paymentMethod }
		};
	} catch (error) {
		console.error('Error loading ticket purchases:', error);
		return {
			tickets: [],
			totalTickets: 0,
			totalRevenue: 0,
			anonymousCount: 0,
			transactionCount: 0,
			pagination: { currentPage: 1, totalPages: 1, pageSize: PAGE_SIZE, totalCount: 0 },
			shows: [],
			years: [],
			paymentMethods: [],
			filters: { showCode, year, dateFrom, dateTo, patronSearch, paymentMethod }
		};
	}
};