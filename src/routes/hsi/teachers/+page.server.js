// src/routes/hsi/teachers/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const teachers = await sql`
			SELECT 
				t.teacher_id,
				t.first_name,
				t.last_name,
				t.email,
				t.phone,
				t.is_active,
				t.created_at,
				COUNT(DISTINCT cs.session_id) AS session_count,
				COUNT(DISTINCT r.registration_id) AS total_students_taught,
				MAX(cs.start_date) AS last_session_date
			FROM teachers t
			LEFT JOIN class_sessions cs ON cs.teacher_id = t.teacher_id
			LEFT JOIN registrations r ON r.session_id = cs.session_id
			GROUP BY t.teacher_id, t.first_name, t.last_name, t.email, t.phone, t.is_active, t.created_at
			ORDER BY t.last_name ASC, t.first_name ASC
		`;

		return {
			teachers: teachers.map((t) => ({
				...t,
				session_count: Number(t.session_count),
				total_students_taught: Number(t.total_students_taught),
				last_session_date: t.last_session_date
					? t.last_session_date.toISOString().split('T')[0]
					: null
			}))
		};
	} catch (error) {
		console.error('Error loading teachers:', error);
		return { teachers: [] };
	}
};