// src/routes/hsi/student_surveys/enter/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals, url, depends }) => {
	requirePermission(locals.user, 'hsi', 'data_entry');
	depends('survey:enter');

	try {
		// Active templates with questions
		const templates = await sql`
			SELECT st.template_id, st.template_name
			FROM survey_templates st
			WHERE st.is_active = true
				AND EXISTS (SELECT 1 FROM survey_questions sq WHERE sq.template_id = st.template_id)
			ORDER BY st.template_name ASC
		`;

		// Recent sessions for selection
		const sessions = await sql`
			SELECT
				cs.session_id,
				cs.session_name,
				cs.class_code,
				cs.instructor,
				cs.start_date,
				cs.end_date,
				c.class_name
			FROM class_sessions cs
			JOIN classes c ON c.class_code = cs.class_code
			ORDER BY cs.start_date DESC
			LIMIT 100
		`;

		// If a session is pre-selected, load its students
		const sessionId = url.searchParams.get('session_id');
		let students = [];
		let questions = [];
		const templateId = url.searchParams.get('template_id');

		console.log('Enter survey load - sessionId:', sessionId, 'templateId:', templateId);

		if (sessionId) {
			students = await sql`
				SELECT DISTINCT s.student_id, s.first_name, s.last_name
				FROM registrations r
				JOIN students s ON s.student_id = r.student_id
				WHERE r.session_id = ${parseInt(sessionId)}
				ORDER BY s.last_name ASC, s.first_name ASC
			`;
			console.log('Loaded students:', students.length);
		}

		if (templateId) {
			questions = await sql`
				SELECT question_id, question_number, question_text, question_type
				FROM survey_questions
				WHERE template_id = ${parseInt(templateId)}
				ORDER BY question_number ASC
			`;
			console.log('Loaded questions:', questions.length);
		}

		return {
			templates,
			sessions: sessions.map(s => ({
				...s,
				start_date: s.start_date ? s.start_date.toISOString().split('T')[0] : null,
				end_date: s.end_date ? s.end_date.toISOString().split('T')[0] : null
			})),
			students,
			questions,
			selectedSessionId: sessionId ? parseInt(sessionId) : null,
			selectedTemplateId: templateId ? parseInt(templateId) : null,
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading survey entry:', error);
		return { templates: [], sessions: [], students: [], questions: [], selectedSessionId: null, selectedTemplateId: null, user: locals.user };
	}
};

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const formData = await request.formData();

		const template_id = parseInt(formData.get('template_id')?.toString() || '0');
		const session_id = parseInt(formData.get('session_id')?.toString() || '0');
		const student_id_raw = formData.get('student_id')?.toString();
		const is_anonymous = student_id_raw === 'anonymous';
		const student_id = is_anonymous ? null : parseInt(student_id_raw || '0');

		if (!template_id || !session_id) {
			return fail(400, { error: 'Template and session are required.' });
		}

		if (!is_anonymous && !student_id) {
			return fail(400, { error: 'Please select a student or choose Anonymous.' });
		}

		// Check for duplicate response (only for non-anonymous — anonymous can have multiple)
		if (!is_anonymous) {
			const [existing] = await sql`
				SELECT response_id FROM survey_responses
				WHERE template_id = ${template_id}
					AND session_id = ${session_id}
					AND student_id = ${student_id}
			`;

			if (existing) {
				return fail(400, { error: 'A survey response already exists for this student, session, and template combination.' });
			}
		}

		// Get questions for this template
		const questions = await sql`
			SELECT question_id, question_type
			FROM survey_questions
			WHERE template_id = ${template_id}
			ORDER BY question_number ASC
		`;

		try {
			// Create response
			const [response] = await sql`
				INSERT INTO survey_responses (template_id, session_id, student_id)
				VALUES (${template_id}, ${session_id}, ${student_id})
				RETURNING response_id
			`;

			// Insert answers
			for (const q of questions) {
				const rawAnswer = formData.get(`q_${q.question_id}`)?.toString().trim() || null;

				let answer_int = null;
				let answer_bool = null;
				let answer_text = null;

				if (rawAnswer !== null) {
					switch (q.question_type) {
						case 'likert':
						case 'rating_1_5':
						case 'rating_1_10':
							answer_int = parseInt(rawAnswer) || null;
							break;
						case 'yes_no':
							answer_bool = rawAnswer === 'true';
							break;
						case 'free_text':
							answer_text = rawAnswer;
							break;
					}
				}

				await sql`
					INSERT INTO survey_answers (response_id, question_id, answer_int, answer_bool, answer_text)
					VALUES (${response.response_id}, ${q.question_id}, ${answer_int}, ${answer_bool}, ${answer_text})
				`;
			}

			throw redirect(303, `/hsi/student_surveys`);
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;
			console.error('Error submitting survey:', err);
			return fail(500, { error: 'Failed to submit survey response.' });
		}
	}
};
