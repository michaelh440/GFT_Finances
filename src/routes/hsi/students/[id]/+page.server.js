// src/routes/hsi/students/[id]/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';
import { hasPermission } from '$lib/permissions';

/** @param {string|null} email */
function maskEmail(email) {
	if (!email) return null;
	const [local, domain] = email.split('@');
	if (!domain) return '***';
	return local[0] + '***@' + domain;
}

/** @param {string|null} phone */
function maskPhone(phone) {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, '');
	if (digits.length <= 4) return '***';
	return '***-***-' + digits.slice(-4);
}

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');
	const canSeePII = hasPermission(locals.user, 'hsi', 'data_entry');
	const studentId = parseInt(params.id);

	if (isNaN(studentId)) {
		return { student: null, registrations: [], totalPaid: 0 };
	}

	try {
		// Get student info
		const studentResult = await sql`
      SELECT student_id, first_name, last_name, email, phone, account_date, is_active
      FROM students
      WHERE student_id = ${studentId}
    `;

		if (studentResult.length === 0) {
			return { student: null, registrations: [], totalPaid: 0 };
		}

		const accountDate = studentResult[0].account_date
			? studentResult[0].account_date.toISOString().split('T')[0]
			: null;

		// Get earliest registration date as "member since"
		const earliestReg = await sql`
      SELECT MIN(class_date) AS first_class_date
      FROM registrations
      WHERE student_id = ${studentId}
    `;
		const memberSince = earliestReg[0].first_class_date
			? earliestReg[0].first_class_date.toISOString().split('T')[0]
			: accountDate;

		const raw = studentResult[0];
		const student = {
			...raw,
			email: canSeePII ? raw.email : maskEmail(raw.email),
			phone: canSeePII ? raw.phone : maskPhone(raw.phone),
			email_masked: maskEmail(raw.email),
			phone_masked: maskPhone(raw.phone),
			account_date: accountDate,
			member_since: memberSince
		};

		// Get all registrations with class and session details
		const registrations = await sql`
      SELECT
        r.registration_id,
        r.class_code,
        r.class_date,
        r.registration_date,
        r.amount_paid,
        r.session_id,
        c.class_name,
        c.track,
        cs.session_name,
        COALESCE(t.first_name || ' ' || t.last_name, cs.instructor) AS instructor,
        cs.location
      FROM registrations r
      JOIN classes c ON r.class_code = c.class_code
      LEFT JOIN class_sessions cs ON r.session_id = cs.session_id
      LEFT JOIN teachers t ON cs.teacher_id = t.teacher_id
      WHERE r.student_id = ${studentId}
      ORDER BY r.class_date DESC
    `;

		// Get total amount paid
		const totalResult = await sql`
      SELECT COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM registrations
      WHERE student_id = ${studentId}
    `;
		const totalPaid = Number(totalResult[0].total_paid);

		// Cross-reference: find matching patron by vbo_account_id, email, or name
		let patronMatch = null;
		let patronTickets = [];
		let patronTotalSpent = 0;

		const studentRaw = studentResult[0];
		// Try vbo_account_id first
		if (studentRaw.vbo_account_id) {
			const [p] = await sql`
				SELECT patron_id, first_name, last_name FROM patrons
				WHERE vbo_account_id = ${studentRaw.vbo_account_id} LIMIT 1
			`;
			if (p) patronMatch = p;
		}
		// Fallback to email
		if (!patronMatch && studentRaw.email) {
			const [p] = await sql`
				SELECT patron_id, first_name, last_name FROM patrons
				WHERE LOWER(TRIM(email)) = ${studentRaw.email.toLowerCase().trim()} LIMIT 1
			`;
			if (p) patronMatch = p;
		}
		// Fallback to name
		if (!patronMatch && studentRaw.first_name && studentRaw.last_name) {
			const [p] = await sql`
				SELECT patron_id, first_name, last_name FROM patrons
				WHERE LOWER(TRIM(first_name)) = ${studentRaw.first_name.toLowerCase().trim()}
				  AND LOWER(TRIM(last_name)) = ${studentRaw.last_name.toLowerCase().trim()} LIMIT 1
			`;
			if (p) patronMatch = p;
		}

		if (patronMatch) {
			const tickets = await sql`
				SELECT st.ticket_id, st.show_code, st.show_date, st.tickets_purchased,
				       st.amount_paid, st.purchase_date, s.show_name, s.format
				FROM show_tickets st
				JOIN shows s ON s.show_code = st.show_code
				WHERE st.patron_id = ${patronMatch.patron_id}
				ORDER BY st.show_date DESC
			`;
			patronTickets = tickets.map((t) => ({
				...t,
				show_date: t.show_date ? t.show_date.toISOString().split('T')[0] : null,
				purchase_date: t.purchase_date ? t.purchase_date.toISOString().split('T')[0] : null,
				tickets_purchased: Number(t.tickets_purchased),
				amount_paid: Number(t.amount_paid)
			}));
			patronTotalSpent = patronTickets.reduce((sum, t) => sum + t.amount_paid, 0);
		}

		return {
			student,
			registrations: registrations.map((r) => ({
				...r,
				class_date: r.class_date ? r.class_date.toISOString().split('T')[0] : null,
				registration_date: r.registration_date
					? r.registration_date.toISOString().split('T')[0]
					: null,
				amount_paid: Number(r.amount_paid || 0)
			})),
			totalPaid,
			patronMatch: patronMatch ? { patron_id: patronMatch.patron_id, first_name: patronMatch.first_name, last_name: patronMatch.last_name } : null,
			patronTickets,
			patronTotalSpent,
			user: locals.user,
			canSeePII,
		};
	} catch (error) {
		console.error('Error loading student detail:', error);
		return { student: null, registrations: [], totalPaid: 0 };
	}
};
