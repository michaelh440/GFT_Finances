// src/routes/promotions/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const promotions = await sql`
			SELECT 
				p.promotion_id,
				p.promotion_name,
				p.discount_type,
				p.discount_value,
				p.start_date,
				p.end_date,
				p.is_active,
				COUNT(DISTINCT st.ticket_id)::int AS transaction_count,
				COALESCE(SUM(st.tickets_purchased), 0)::int AS tickets_sold,
				COALESCE(SUM(st.amount_paid), 0)::numeric AS total_revenue,
				COUNT(DISTINCT st.show_code)::int AS shows_used
			FROM promotions p
			LEFT JOIN show_tickets st ON st.promotion_id = p.promotion_id
			GROUP BY p.promotion_id
			ORDER BY p.promotion_name ASC
		`;

		return {
			promotions: promotions.map((p) => ({
				...p,
				discount_value: p.discount_value ? Number(p.discount_value) : null,
				total_revenue: Number(p.total_revenue),
				start_date: p.start_date ? p.start_date.toISOString().split('T')[0] : null,
				end_date: p.end_date ? p.end_date.toISOString().split('T')[0] : null
			}))
		};
	} catch (error) {
		console.error('Error loading promotions:', error);
		return { promotions: [] };
	}
};