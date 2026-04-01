// src/routes/shows/patrons/[patron_id]/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'gft', 'viewer');
	const { patron_id } = params;

	try {
		const [patron] = await sql`
			SELECT 
				patron_id,
				first_name,
				last_name,
				email,
				phone,
				is_active,
				created_at,
				updated_at
			FROM patrons
			WHERE patron_id = ${patron_id}
		`;

		if (!patron) {
			return {
				patron: null,
				tickets: [],
				totalTickets: 0,
				totalSpent: 0
			};
		}

		const tickets = await sql`
			SELECT 
				st.ticket_id,
				st.show_code,
				st.show_date,
				st.tickets_purchased,
				st.amount_paid,
				st.purchase_date,
				st.payment_method,
				st.notes,
				s.show_name,
				s.format
			FROM show_tickets st
			JOIN shows s ON s.show_code = st.show_code
			WHERE st.patron_id = ${patron_id}
			ORDER BY st.show_date DESC
		`;

		const totalTickets = tickets.reduce((sum, t) => sum + Number(t.tickets_purchased), 0);
		const totalSpent = tickets.reduce((sum, t) => sum + Number(t.amount_paid), 0);

		return {
			patron,
			tickets: tickets.map((t) => ({
				...t,
				tickets_purchased: Number(t.tickets_purchased),
				amount_paid: Number(t.amount_paid)
			})),
			totalTickets,
			totalSpent
		};
	} catch (error) {
		console.error('Error loading patron detail:', error);
		return {
			patron: null,
			tickets: [],
			totalTickets: 0,
			totalSpent: 0
		};
	}
};