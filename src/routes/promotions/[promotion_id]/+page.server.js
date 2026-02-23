// src/routes/promotions/[promotion_id]/+page.server.js
import sql from '$lib/db';

export const load = async ({ params }) => {
	const promotionId = parseInt(params.promotion_id);

	if (isNaN(promotionId)) {
		return { promotion: null };
	}

	try {
		const [promotion] = await sql`
			SELECT promotion_id, promotion_name, description, discount_type,
				discount_value, start_date, end_date, is_active, created_at
			FROM promotions
			WHERE promotion_id = ${promotionId}
		`;

		if (!promotion) {
			return { promotion: null };
		}

		// Linked shows
		const linkedShows = await sql`
			SELECT ps.show_code, s.show_name, s.format
			FROM promotion_shows ps
			JOIN shows s ON s.show_code = ps.show_code
			WHERE ps.promotion_id = ${promotionId}
			ORDER BY s.show_name ASC
		`;

		// Ticket stats by show
		const showStats = await sql`
			SELECT
				st.show_code,
				s.show_name,
				s.format,
				s.standard_ticket_price,
				COUNT(st.ticket_id)::int AS transaction_count,
				SUM(st.tickets_purchased)::int AS tickets_sold,
				SUM(st.amount_paid)::numeric AS revenue,
				MIN(st.show_date) AS first_use,
				MAX(st.show_date) AS last_use
			FROM show_tickets st
			JOIN shows s ON s.show_code = st.show_code
			WHERE st.promotion_id = ${promotionId}
			GROUP BY st.show_code, s.show_name, s.format, s.standard_ticket_price
			ORDER BY tickets_sold DESC
		`;

		// Aggregate totals
		const [totals] = await sql`
			SELECT
				COUNT(ticket_id)::int AS total_transactions,
				COALESCE(SUM(tickets_purchased), 0)::int AS total_tickets,
				COALESCE(SUM(amount_paid), 0)::numeric AS total_revenue,
				COUNT(DISTINCT patron_id)::int AS unique_patrons,
				MIN(show_date) AS first_use,
				MAX(show_date) AS last_use
			FROM show_tickets
			WHERE promotion_id = ${promotionId}
		`;

		// Estimated discount given (compare to standard price)
		const [discountTotals] = await sql`
			SELECT
				COALESCE(SUM(s.standard_ticket_price * st.tickets_purchased), 0)::numeric AS would_have_been,
				COALESCE(SUM(st.amount_paid), 0)::numeric AS actual_paid
			FROM show_tickets st
			JOIN shows s ON s.show_code = st.show_code
			WHERE st.promotion_id = ${promotionId}
		`;

		return {
			promotion: {
				...promotion,
				discount_value: promotion.discount_value ? Number(promotion.discount_value) : null,
				start_date: promotion.start_date ? promotion.start_date.toISOString().split('T')[0] : null,
				end_date: promotion.end_date ? promotion.end_date.toISOString().split('T')[0] : null,
				created_at: promotion.created_at ? promotion.created_at.toISOString().split('T')[0] : null
			},
			linkedShows,
			showStats: showStats.map((s) => ({
				...s,
				standard_ticket_price: Number(s.standard_ticket_price || 0),
				revenue: Number(s.revenue),
				first_use: s.first_use ? s.first_use.toISOString().split('T')[0] : null,
				last_use: s.last_use ? s.last_use.toISOString().split('T')[0] : null
			})),
			totals: {
				...totals,
				total_revenue: Number(totals.total_revenue),
				first_use: totals.first_use ? totals.first_use.toISOString().split('T')[0] : null,
				last_use: totals.last_use ? totals.last_use.toISOString().split('T')[0] : null
			},
			discountTotals: {
				would_have_been: Number(discountTotals.would_have_been),
				actual_paid: Number(discountTotals.actual_paid),
				total_discount: Number(discountTotals.would_have_been) - Number(discountTotals.actual_paid)
			}
		};
	} catch (error) {
		console.error('Error loading promotion detail:', error);
		return { promotion: null };
	}
};