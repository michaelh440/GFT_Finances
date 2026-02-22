// src/routes/shows/patrons/+page.server.js
import sql from '$lib/db';

const PAGE_SIZE = 50;

export const load = async ({ url }) => {
	const search = url.searchParams.get('search') || '';
	const currentPage = Math.max(1, parseInt(url.searchParams.get('page') || '1'));

	try {
		// Build WHERE clause for search
		const searchCondition = search
			? sql`WHERE (
				LOWER(p.first_name) LIKE ${`%${search.toLowerCase()}%`}
				OR LOWER(p.last_name) LIKE ${`%${search.toLowerCase()}%`}
				OR LOWER(p.email) LIKE ${`%${search.toLowerCase()}%`}
			)`
			: sql``;

		// Count total matching patrons
		const [countResult] = await sql`
			SELECT COUNT(*)::int AS total
			FROM patrons p
			${searchCondition}
		`;
		const totalCount = countResult.total;
		const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
		const safePage = Math.min(currentPage, totalPages);
		const offset = (safePage - 1) * PAGE_SIZE;

		// Fetch current page of patrons with ticket stats
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
			LEFT JOIN show_tickets st ON st.patron_id = p.patron_id
			${searchCondition}
			GROUP BY p.patron_id, p.first_name, p.last_name, p.email, p.phone, p.is_active, p.created_at
			ORDER BY p.last_name ASC, p.first_name ASC
			LIMIT ${PAGE_SIZE}
			OFFSET ${offset}
		`;

		// Summary stats (always over the full dataset, not filtered)
		const [stats] = await sql`
			SELECT
				(SELECT COUNT(*) FROM patrons)::int AS total_patrons,
				(SELECT COUNT(*) FROM patrons WHERE is_active = true)::int AS active_patrons,
				(SELECT COUNT(*) FROM patrons p2 
				 WHERE (SELECT COUNT(*) FROM show_tickets st2 WHERE st2.patron_id = p2.patron_id) > 1
				)::int AS repeat_patrons,
				COUNT(DISTINCT st.ticket_id)::int AS total_transactions,
				COALESCE(SUM(st.tickets_purchased), 0)::int AS total_tickets,
				COALESCE(SUM(st.amount_paid), 0)::numeric AS total_revenue,
				COUNT(DISTINCT st.ticket_id) FILTER (WHERE st.patron_id IS NULL)::int AS anonymous_transactions,
				COALESCE(SUM(st.tickets_purchased) FILTER (WHERE st.patron_id IS NULL), 0)::int AS anonymous_tickets,
				COALESCE(SUM(st.amount_paid) FILTER (WHERE st.patron_id IS NULL), 0)::numeric AS anonymous_revenue
			FROM show_tickets st
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
				activePatrons: stats.active_patrons,
				repeatPatrons: stats.repeat_patrons,
				totalTransactions: stats.total_transactions,
				totalTickets: Number(stats.total_tickets),
				totalRevenue: Number(stats.total_revenue),
				anonymousTransactions: stats.anonymous_transactions,
				anonymousTickets: Number(stats.anonymous_tickets),
				anonymousRevenue: Number(stats.anonymous_revenue)
			},
			pagination: {
				currentPage: safePage,
				totalPages,
				pageSize: PAGE_SIZE,
				totalCount
			},
			search
		};
	} catch (error) {
		console.error('Error loading patrons:', error);
		return {
			patrons: [],
			stats: {},
			pagination: { currentPage: 1, totalPages: 1, pageSize: PAGE_SIZE, totalCount: 0 },
			search
		};
	}
};