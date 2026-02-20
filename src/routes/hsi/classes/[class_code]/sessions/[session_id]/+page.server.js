// src/routes/hsi/classes/[class_code]/sessions/[session_id]/+page.server.js
import sql from '$lib/db';

export const load = async ({ params }) => {
	const { class_code, session_id } = params;

	try {
		// Get the class info
		const [classInfo] = await sql`
			SELECT 
				class_code,
				class_name,
				track,
				standard_price
			FROM classes
			WHERE class_code = ${class_code}
		`;

		if (!classInfo) {
			return {
				classInfo: null,
				session: null,
				students: [],
				totalRevenue: 0
			};
		}

		// Get the session info
		const [session] = await sql`
			SELECT 
				session_id,
				session_name,
				class_code,
				start_date,
				end_date,
				instructor,
				location,
				is_active,
				created_at
			FROM class_sessions
			WHERE session_id = ${session_id}
				AND class_code = ${class_code}
		`;

		if (!session) {
			return {
				classInfo: {
					...classInfo,
					standard_price: Number(classInfo.standard_price)
				},
				session: null,
				students: [],
				totalRevenue: 0
			};
		}

		// Get registered students for this session
		const students = await sql`
			SELECT 
				r.registration_id,
				r.student_id,
				s.first_name,
				s.last_name,
				s.email,
				s.phone,
				r.amount_paid,
				r.registration_date,
				r.class_date
			FROM registrations r
			JOIN students s ON s.student_id = r.student_id
			WHERE r.session_id = ${session_id}
			ORDER BY s.last_name ASC, s.first_name ASC
		`;

		const totalRevenue = students.reduce((sum, s) => sum + Number(s.amount_paid), 0);

		return {
			classInfo: {
				...classInfo,
				standard_price: Number(classInfo.standard_price)
			},
			session,
			students: students.map((s) => ({
				...s,
				amount_paid: Number(s.amount_paid)
			})),
			totalRevenue
		};
	} catch (error) {
		console.error('Error loading session detail:', error);
		return {
			classInfo: null,
			session: null,
			students: [],
			totalRevenue: 0
		};
	}
};