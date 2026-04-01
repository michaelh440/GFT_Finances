// src/routes/shows/[show_code]/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'gft', 'viewer');
	const { show_code } = params;

	try {
		// Get the show info
		const [showInfo] = await sql`
			SELECT 
				show_code,
				show_name,
				format,
				audience_type,
				day_of_week,
				standard_ticket_price,
				vbo_event_id,
				description,
				is_active,
				created_at,
				updated_at
			FROM shows
			WHERE show_code = ${show_code}
		`;

		if (!showInfo) {
			return {
				showInfo: null,
				summaries: [],
				totalTickets: 0,
				totalRevenue: 0
			};
		}

		// Get all monthly summaries for this show
		const summaries = await sql`
			SELECT 
				show_code,
				summary_month,
				summary_year,
				tickets_sold,
				revenue,
				created_at,
				updated_at
			FROM monthly_show_summary
			WHERE show_code = ${show_code}
			ORDER BY summary_month DESC
		`;

		const totalTickets = summaries.reduce((sum, s) => sum + Number(s.tickets_sold), 0);
		const totalRevenue = summaries.reduce((sum, s) => sum + Number(s.revenue), 0);

		return {
			showInfo: {
				...showInfo,
				standard_ticket_price: Number(showInfo.standard_ticket_price || 0)
			},
			summaries: summaries.map((s) => ({
				...s,
				tickets_sold: Number(s.tickets_sold),
				revenue: Number(s.revenue)
			})),
			totalTickets,
			totalRevenue
		};
	} catch (error) {
		console.error('Error loading show detail:', error);
		return {
			showInfo: null,
			summaries: [],
			totalTickets: 0,
			totalRevenue: 0
		};
	}
};