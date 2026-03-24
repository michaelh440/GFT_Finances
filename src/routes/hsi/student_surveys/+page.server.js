// src/routes/hsi/student_surveys/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');

	// Use a simpler query that adapts to whatever columns exist
	const templates = await sql`
		SELECT
			st.*,
			COUNT(DISTINCT sq.question_id)::int AS question_count,
			COUNT(DISTINCT sr.response_id)::int AS response_count
		FROM survey_templates st
		LEFT JOIN survey_questions sq ON sq.template_id = st.template_id
		LEFT JOIN survey_responses sr ON sr.template_id = st.template_id
		GROUP BY st.template_id
		ORDER BY st.template_name ASC
	`.catch(err => {
		console.error('Error loading templates:', err);
		return [];
	});

	// Discover actual column names from survey_responses
	const [sampleRow] = await sql`SELECT * FROM survey_responses LIMIT 1`.catch(() => []);
	const hasSubmittedAt = sampleRow && 'submitted_at' in sampleRow;
	const dateCol = hasSubmittedAt ? 'submitted_at' : 'created_at';
	console.log('survey_responses columns:', sampleRow ? Object.keys(sampleRow) : 'no rows', '-> using date col:', dateCol);

	const recentResponses = await sql`
		SELECT
			sr.response_id,
			sr.${sql(dateCol)} AS submitted_at,
			st.template_name,
			COALESCE(s.first_name || ' ' || s.last_name, 'Anonymous') AS student_name,
			cs.session_name,
			c.class_name,
			cs.instructor
		FROM survey_responses sr
		JOIN survey_templates st ON st.template_id = sr.template_id
		LEFT JOIN students s ON s.student_id = sr.student_id
		JOIN class_sessions cs ON cs.session_id = sr.session_id
		JOIN classes c ON c.class_code = cs.class_code
		ORDER BY sr.${sql(dateCol)} DESC
		LIMIT 20
	`.catch(err => {
		console.error('Error loading recent responses:', err);
		return [];
	});

	return {
		templates,
		recentResponses: recentResponses.map(r => ({
			...r,
			submitted_at: r.submitted_at
				? (typeof r.submitted_at === 'string' ? r.submitted_at : r.submitted_at.toISOString().split('T')[0])
				: null
		})),
		user: locals.user
	};
};
