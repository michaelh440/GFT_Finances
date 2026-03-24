// src/routes/hsi/student_surveys/results/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals, url, depends }) => {
	requirePermission(locals.user, 'hsi', 'viewer');
	depends('survey:results');

	// Filter parameters
	console.log('Results page load - URL search:', url.search);
	const templateId = url.searchParams.get('template_id');
	const classCode = url.searchParams.get('class_code');
	const instructor = url.searchParams.get('instructor');
	const sessionId = url.searchParams.get('session_id');

	try {
		// Load filter options
		const templates = await sql`
			SELECT template_id, template_name FROM survey_templates ORDER BY template_name ASC
		`;

		const classes = await sql`
			SELECT DISTINCT c.class_code, c.class_name
			FROM classes c
			JOIN class_sessions cs ON cs.class_code = c.class_code
			JOIN survey_responses sr ON sr.session_id = cs.session_id
			ORDER BY c.class_name ASC
		`;

		const instructors = await sql`
			SELECT DISTINCT cs.instructor
			FROM class_sessions cs
			JOIN survey_responses sr ON sr.session_id = cs.session_id
			WHERE cs.instructor IS NOT NULL
			ORDER BY cs.instructor ASC
		`;

		const sessions = await sql`
			SELECT DISTINCT cs.session_id, cs.session_name, c.class_name, cs.start_date
			FROM class_sessions cs
			JOIN classes c ON c.class_code = cs.class_code
			JOIN survey_responses sr ON sr.session_id = cs.session_id
			ORDER BY cs.start_date DESC
		`;

		// Build dynamic query for aggregate results
		let results = [];
		let responseCount = 0;
		let freeTextAnswers = [];

		console.log('Results filters - templateId:', templateId, 'classCode:', classCode, 'instructor:', instructor, 'sessionId:', sessionId);

		const hasAnyFilter = templateId || classCode || instructor || sessionId;

		if (hasAnyFilter) {
			// Build filter conditions using postgres library's fragment helper
			const templateFilter = templateId ? sql`AND sr.template_id = ${parseInt(templateId)}` : sql``;
			const classFilter = classCode ? sql`AND cs.class_code = ${classCode}` : sql``;
			const instructorFilter = instructor ? sql`AND cs.instructor = ${instructor}` : sql``;
			const sessionFilter = sessionId ? sql`AND cs.session_id = ${parseInt(sessionId)}` : sql``;

			// Get response count
			const [countRow] = await sql`
				SELECT COUNT(DISTINCT sr.response_id)::int AS count
				FROM survey_responses sr
				JOIN class_sessions cs ON cs.session_id = sr.session_id
				WHERE 1=1
				${templateFilter}
				${classFilter}
				${instructorFilter}
				${sessionFilter}
			`;
			responseCount = countRow.count;
			console.log('Response count:', responseCount);

			// Get aggregate ratings for numeric questions
			results = await sql`
				SELECT
					sq.question_number,
					sq.question_text,
					sq.question_type,
					AVG(sa.answer_int)::numeric AS avg_rating,
					MIN(sa.answer_int)::int AS min_rating,
					MAX(sa.answer_int)::int AS max_rating,
					COUNT(sa.answer_id)::int AS answer_count
				FROM survey_answers sa
				JOIN survey_questions sq ON sq.question_id = sa.question_id
				JOIN survey_responses sr ON sr.response_id = sa.response_id
				JOIN class_sessions cs ON cs.session_id = sr.session_id
				WHERE sq.question_type IN ('likert', 'rating_1_5', 'rating_1_10')
				AND sa.answer_int IS NOT NULL
				${templateFilter}
				${classFilter}
				${instructorFilter}
				${sessionFilter}
				GROUP BY sq.question_number, sq.question_text, sq.question_type
				ORDER BY sq.question_number
			`;

			// Yes/No aggregate
			const ynResults = await sql`
				SELECT
					sq.question_number,
					sq.question_text,
					sq.question_type,
					COUNT(CASE WHEN sa.answer_bool = true THEN 1 END)::int AS yes_count,
					COUNT(CASE WHEN sa.answer_bool = false THEN 1 END)::int AS no_count,
					COUNT(sa.answer_id)::int AS answer_count
				FROM survey_answers sa
				JOIN survey_questions sq ON sq.question_id = sa.question_id
				JOIN survey_responses sr ON sr.response_id = sa.response_id
				JOIN class_sessions cs ON cs.session_id = sr.session_id
				WHERE sq.question_type = 'yes_no'
				AND sa.answer_bool IS NOT NULL
				${templateFilter}
				${classFilter}
				${instructorFilter}
				${sessionFilter}
				GROUP BY sq.question_number, sq.question_text, sq.question_type
				ORDER BY sq.question_number
			`;

			// Free text responses
			freeTextAnswers = await sql`
				SELECT
					sq.question_number,
					sq.question_text,
					sa.answer_text,
					COALESCE(s.first_name || ' ' || s.last_name, 'Anonymous') AS student_name,
					cs.session_name,
					c.class_name
				FROM survey_answers sa
				JOIN survey_questions sq ON sq.question_id = sa.question_id
				JOIN survey_responses sr ON sr.response_id = sa.response_id
				JOIN class_sessions cs ON cs.session_id = sr.session_id
				JOIN classes c ON c.class_code = cs.class_code
				LEFT JOIN students s ON s.student_id = sr.student_id
				WHERE sq.question_type = 'free_text'
				AND sa.answer_text IS NOT NULL
				${templateFilter}
				${classFilter}
				${instructorFilter}
				${sessionFilter}
				ORDER BY sq.question_number, sr.response_id DESC
			`;

			// Merge yn results into results array
			results = [
				...results.map(r => ({
					...r,
					avg_rating: r.avg_rating ? Number(Number(r.avg_rating).toFixed(2)) : null
				})),
				...ynResults.map(r => ({
					...r,
					avg_rating: null,
					min_rating: null,
					max_rating: null,
					yes_pct: r.answer_count > 0 ? Math.round((r.yes_count / r.answer_count) * 100) : 0
				}))
			].sort((a, b) => a.question_number - b.question_number);
			console.log('Results count:', results.length, 'Free text count:', freeTextAnswers.length);
		}

		return {
			templates,
			classes,
			instructors,
			sessions: sessions.map(s => ({
				...s,
				start_date: s.start_date ? s.start_date.toISOString().split('T')[0] : null
			})),
			results,
			freeTextAnswers,
			responseCount,
			filters: {
				templateId: templateId ? parseInt(templateId) : null,
				classCode,
				instructor,
				sessionId: sessionId ? parseInt(sessionId) : null
			},
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading survey results:', error);
		return {
			templates: [], classes: [], instructors: [], sessions: [],
			results: [], freeTextAnswers: [], responseCount: 0,
			filters: { templateId: null, classCode: null, instructor: null, sessionId: null },
			user: locals.user
		};
	}
};
