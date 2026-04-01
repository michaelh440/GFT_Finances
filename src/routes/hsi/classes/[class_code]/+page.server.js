// src/routes/hsi/classes/[class_code]/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');
	const { class_code } = params;

	try {
		// Get the class info
		const [classInfo] = await sql`
			SELECT 
				class_code,
				class_name,
				class_type,
				student_type,
				standard_price,
				track,
				vbo_event_id,
				description,
				duration_value,
				duration_unit,
				is_active,
				created_at,
				updated_at
			FROM classes
			WHERE class_code = ${class_code}
		`;

		if (!classInfo) {
			return {
				classInfo: null,
				sessions: [],
				totalRegistrations: 0,
				totalRevenue: 0
			};
		}

		// Get all sessions for this class with registration counts and revenue
		const sessions = await sql`
			SELECT
				cs.session_id,
				cs.session_name,
				cs.class_code,
				cs.start_date,
				cs.end_date,
				COALESCE(t.first_name || ' ' || t.last_name, cs.instructor) AS instructor,
				cs.location,
				cs.duration_value,
				cs.duration_unit,
				cs.is_active,
				cs.created_at,
				COUNT(DISTINCT r.student_id) AS student_count,
				COUNT(r.registration_id) AS registration_count,
				COALESCE(SUM(r.amount_paid), 0) AS session_revenue
			FROM class_sessions cs
			LEFT JOIN teachers t ON cs.teacher_id = t.teacher_id
			LEFT JOIN registrations r ON r.session_id = cs.session_id
			WHERE cs.class_code = ${class_code}
			GROUP BY cs.session_id, cs.session_name, cs.class_code, cs.start_date,
				cs.end_date, t.first_name, t.last_name, cs.instructor, cs.location, cs.duration_value, cs.duration_unit, cs.is_active, cs.created_at
			ORDER BY cs.start_date DESC
		`;

		// Calculate totals
		const totalStudents = sessions.reduce((sum, s) => sum + Number(s.student_count), 0);
		const totalRegistrations = sessions.reduce((sum, s) => sum + Number(s.registration_count), 0);
		const totalRevenue = sessions.reduce((sum, s) => sum + Number(s.session_revenue), 0);

		return {
			classInfo: {
				...classInfo,
				standard_price: Number(classInfo.standard_price)
			},
			sessions: sessions.map((s) => ({
				...s,
				start_date: s.start_date ? s.start_date.toISOString().split('T')[0] : null,
				end_date: s.end_date ? s.end_date.toISOString().split('T')[0] : null,
				student_count: Number(s.student_count),
				registration_count: Number(s.registration_count),
				session_revenue: Number(s.session_revenue)
			})),
			totalStudents,
			totalRegistrations,
			totalRevenue,
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading class detail:', error);
		return {
			classInfo: null,
			sessions: [],
			totalStudents: 0,
			totalRegistrations: 0,
			totalRevenue: 0
		};
	}
};