// src/routes/hsi/teachers/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';
import { hasPermission } from '$lib/permissions';

/**
 * Mask an email: show first char + "***@" + domain
 * @param {string|null} email
 */
function maskEmail(email) {
	if (!email) return null;
	const [local, domain] = email.split('@');
	if (!domain) return '***';
	return local[0] + '***@' + domain;
}

/**
 * Mask a phone: show last 4 digits only
 * @param {string|null} phone
 */
function maskPhone(phone) {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, '');
	if (digits.length <= 4) return '***';
	return '***-***-' + digits.slice(-4);
}

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');

	const canSeePII = hasPermission(locals.user, 'hsi', 'data_entry');

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
				// Real values only sent to data_entry+; viewers get masked on the server
				email: canSeePII ? t.email : maskEmail(t.email),
				phone: canSeePII ? t.phone : maskPhone(t.phone),
				// Masked versions always included for display toggle
				email_masked: maskEmail(t.email),
				phone_masked: maskPhone(t.phone),
				session_count: Number(t.session_count),
				total_students_taught: Number(t.total_students_taught),
				last_session_date: t.last_session_date
					? t.last_session_date.toISOString().split('T')[0]
					: null
			})),
			user: locals.user,
			canSeePII,
		};
	} catch (error) {
		console.error('Error loading teachers:', error);
		return { teachers: [], canSeePII: false };
	}
};