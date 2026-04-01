// src/routes/hsi/classes/[class_code]/sessions/[session_id]/+page.server.js
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
	const { class_code, session_id } = params;
	const canSeePII = hasPermission(locals.user, 'hsi', 'data_entry');

	try {
		// Get the class info
		const [classInfo] = await sql`
			SELECT 
				class_code,
				class_name,
				track,
				standard_price,
				duration_value,
				duration_unit
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
				cs.session_id,
				cs.session_name,
				cs.class_code,
				cs.start_date,
				cs.end_date,
				cs.start_time,
				cs.end_time,
				cs.teacher_id,
				COALESCE(t.first_name || ' ' || t.last_name, cs.instructor) AS instructor,
				cs.location,
				cs.duration_value,
				cs.duration_unit,
				cs.is_active,
				cs.created_at
			FROM class_sessions cs
			LEFT JOIN teachers t ON cs.teacher_id = t.teacher_id
			WHERE cs.session_id = ${session_id}
				AND cs.class_code = ${class_code}
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
				COALESCE(NULLIF(s.phone, ''), s.mobile_phone) AS phone,
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
				email: canSeePII ? s.email : maskEmail(s.email),
				phone: canSeePII ? s.phone : maskPhone(s.phone),
				email_masked: maskEmail(s.email),
				phone_masked: maskPhone(s.phone),
				amount_paid: Number(s.amount_paid)
			})),
			totalRevenue,
			user: locals.user,
			canSeePII,
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