// src/routes/hsi/teachers/[teacher_id]/+page.server.js
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
	const teacherId = parseInt(params.teacher_id);

	if (isNaN(teacherId)) {
		return { teacher: null, sessions: [], stats: {} };
	}

	try {
		// Get teacher info
		const [teacher] = await sql`
			SELECT teacher_id, first_name, last_name, email, phone, bio, is_active, created_at
			FROM teachers
			WHERE teacher_id = ${teacherId}
		`;

		if (!teacher) {
			return { teacher: null, sessions: [], stats: {} };
		}

		// Get all sessions taught by this teacher with registration counts and revenue
		const tid = teacher.teacher_id;
		const sessions = await sql`
			SELECT
				cs.session_id,
				cs.session_name,
				cs.class_code,
				cs.start_date,
				cs.end_date,
				cs.location,
				cs.is_active AS session_active,
				c.class_name,
				c.track,
				COUNT(r.registration_id)::int AS registration_count,
				COALESCE(SUM(r.amount_paid), 0)::numeric AS session_revenue
			FROM class_sessions cs
			JOIN classes c ON c.class_code = cs.class_code
			LEFT JOIN registrations r ON r.session_id = cs.session_id
			WHERE cs.teacher_id = ${tid}
			GROUP BY cs.session_id, cs.session_name, cs.class_code, cs.start_date,
				cs.end_date, cs.location, cs.is_active, c.class_name, c.track
			ORDER BY cs.start_date DESC
		`;

		// Aggregate stats
		const totalSessions = sessions.length;
		const totalStudents = sessions.reduce((sum, s) => sum + s.registration_count, 0);
		const totalRevenue = sessions.reduce((sum, s) => sum + Number(s.session_revenue), 0);
		const uniqueClasses = new Set(sessions.map((s) => s.class_code)).size;

		// Get survey averages for this teacher (if surveys exist)
		const surveyStats = await sql`
			SELECT
				sq.question_number,
				sq.question_text,
				sq.question_type,
				AVG(sa.answer_int)::numeric AS avg_rating,
				COUNT(sa.answer_id)::int AS response_count
			FROM survey_answers sa
			JOIN survey_questions sq ON sq.question_id = sa.question_id
			JOIN survey_responses sr ON sr.response_id = sa.response_id
			JOIN class_sessions cs ON cs.session_id = sr.session_id
			WHERE cs.teacher_id = ${tid}
				AND sq.question_type IN ('likert', 'rating_1_5', 'rating_1_10')
				AND sa.answer_int IS NOT NULL
			GROUP BY sq.question_number, sq.question_text, sq.question_type
			ORDER BY sq.question_number
		`.catch(() => []);

		return {
			teacher: {
				...teacher,
				email: canSeePII ? teacher.email : maskEmail(teacher.email),
				phone: canSeePII ? teacher.phone : maskPhone(teacher.phone),
				email_masked: maskEmail(teacher.email),
				phone_masked: maskPhone(teacher.phone),
				created_at: teacher.created_at ? teacher.created_at.toISOString().split('T')[0] : null
			},
			sessions: sessions.map((s) => ({
				...s,
				start_date: s.start_date ? s.start_date.toISOString().split('T')[0] : null,
				end_date: s.end_date ? s.end_date.toISOString().split('T')[0] : null,
				session_revenue: Number(s.session_revenue)
			})),
			stats: {
				totalSessions,
				totalStudents,
				totalRevenue,
				uniqueClasses
			},
			surveyStats: surveyStats.map((s) => ({
				...s,
				avg_rating: s.avg_rating ? Number(Number(s.avg_rating).toFixed(2)) : null
			})),
			user: locals.user,
			canSeePII,
		};
	} catch (error) {
		console.error('Error loading teacher detail:', error);
		return { teacher: null, sessions: [], stats: {}, surveyStats: [] };
	}
};