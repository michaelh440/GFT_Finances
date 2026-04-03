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

		// Cross-reference: find matching student by vbo_account_id, email, or name
		let studentMatch = null;
		let studentRegistrations = [];
		let studentTotalPaid = 0;

		// Try vbo_account_id first
		if (patron.vbo_account_id) {
			const [s] = await sql`
				SELECT student_id, first_name, last_name FROM students
				WHERE vbo_account_id = ${patron.vbo_account_id} LIMIT 1
			`;
			if (s) studentMatch = s;
		}
		// Fallback to email
		if (!studentMatch && patron.email) {
			const [s] = await sql`
				SELECT student_id, first_name, last_name FROM students
				WHERE LOWER(TRIM(email)) = ${patron.email.toLowerCase().trim()} LIMIT 1
			`;
			if (s) studentMatch = s;
		}
		// Fallback to name
		if (!studentMatch && patron.first_name && patron.last_name) {
			const [s] = await sql`
				SELECT student_id, first_name, last_name FROM students
				WHERE LOWER(TRIM(first_name)) = ${patron.first_name.toLowerCase().trim()}
				  AND LOWER(TRIM(last_name)) = ${patron.last_name.toLowerCase().trim()} LIMIT 1
			`;
			if (s) studentMatch = s;
		}

		if (studentMatch) {
			const regs = await sql`
				SELECT r.registration_id, r.class_code, r.class_date, r.amount_paid,
				       r.session_id, c.class_name, c.track,
				       cs.session_name
				FROM registrations r
				JOIN classes c ON r.class_code = c.class_code
				LEFT JOIN class_sessions cs ON r.session_id = cs.session_id
				WHERE r.student_id = ${studentMatch.student_id}
				ORDER BY r.class_date DESC
			`;
			studentRegistrations = regs.map((r) => ({
				...r,
				class_date: r.class_date ? r.class_date.toISOString().split('T')[0] : null,
				amount_paid: Number(r.amount_paid || 0)
			}));
			studentTotalPaid = studentRegistrations.reduce((sum, r) => sum + r.amount_paid, 0);
		}

		return {
			patron,
			tickets: tickets.map((t) => ({
				...t,
				tickets_purchased: Number(t.tickets_purchased),
				amount_paid: Number(t.amount_paid)
			})),
			totalTickets,
			totalSpent,
			studentMatch: studentMatch ? { student_id: studentMatch.student_id, first_name: studentMatch.first_name, last_name: studentMatch.last_name } : null,
			studentRegistrations,
			studentTotalPaid,
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