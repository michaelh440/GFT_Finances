// src/routes/hsi/students/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const students = await sql`
      SELECT 
        s.student_id,
        s.first_name,
        s.last_name,
        s.email,
        s.phone,
        s.gender,
        s.age,
        s.account_date,
        s.is_active,
        COUNT(r.registration_id) AS registration_count,
        MAX(r.class_date) AS last_class_date
      FROM students s
      LEFT JOIN registrations r ON s.student_id = r.student_id
      GROUP BY s.student_id
      ORDER BY s.last_name ASC, s.first_name ASC
    `;

		return {
			students: students.map((s) => ({
				...s,
				registration_count: Number(s.registration_count),
				account_date: s.account_date ? s.account_date.toISOString().split('T')[0] : null,
				last_class_date: s.last_class_date ? s.last_class_date.toISOString().split('T')[0] : null
			}))
		};
	} catch (error) {
		console.error('Error loading students:', error);
		return {
			students: []
		};
	}
};
