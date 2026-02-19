// src/routes/hsi/students/[id]/+page.server.js
import sql from '$lib/db';

export const load = async ({ params }) => {
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

		const student = {
			...studentResult[0],
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
        cs.instructor,
        cs.location
      FROM registrations r
      JOIN classes c ON r.class_code = c.class_code
      LEFT JOIN class_sessions cs ON r.session_id = cs.session_id
      WHERE r.student_id = ${studentId}
      ORDER BY r.class_date DESC
    `;

		// Get total amount paid
		const totalResult = await sql`
      SELECT COALESCE(SUM(amount_paid), 0) AS total_paid
      FROM registrations
      WHERE student_id = ${studentId}
    `;

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
			totalPaid: Number(totalResult[0].total_paid)
		};
	} catch (error) {
		console.error('Error loading student detail:', error);
		return { student: null, registrations: [], totalPaid: 0 };
	}
};
