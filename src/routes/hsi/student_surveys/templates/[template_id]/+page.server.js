// src/routes/hsi/student_surveys/templates/[template_id]/+page.server.js
import sql from '$lib/db';
import { fail } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');

	const templateId = parseInt(params.template_id);
	if (isNaN(templateId)) {
		return { template: null, questions: [], responseCount: 0, user: locals.user };
	}

	const [template] = await sql`
		SELECT * FROM survey_templates
		WHERE template_id = ${templateId}
	`.catch(err => {
		console.error('Error querying survey_templates:', err);
		return [];
	});

	if (!template) {
		return { template: null, questions: [], responseCount: 0, user: locals.user };
	}

	const questions = await sql`
		SELECT * FROM survey_questions
		WHERE template_id = ${templateId}
		ORDER BY question_number ASC
	`.catch(err => {
		console.error('Error querying survey_questions:', err);
		return [];
	});

	const [countRow] = await sql`
		SELECT COUNT(*)::int AS count
		FROM survey_responses
		WHERE template_id = ${templateId}
	`.catch(() => [{ count: 0 }]);

	return {
		template: {
			...template,
			created_at: template.created_at
				? (typeof template.created_at === 'string' ? template.created_at : template.created_at.toISOString().split('T')[0])
				: null
		},
		questions,
		responseCount: countRow?.count || 0,
		user: locals.user
	};
};

export const actions = {
	addQuestion: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const templateId = parseInt(params.template_id);
		const formData = await request.formData();

		const question_text = formData.get('question_text')?.toString().trim();
		const question_type = formData.get('question_type')?.toString();

		if (!question_text) {
			return fail(400, { error: 'Question text is required.', action: 'addQuestion' });
		}

		if (!question_type) {
			return fail(400, { error: 'Question type is required.', action: 'addQuestion' });
		}

		try {
			// Get next question number
			const [maxQ] = await sql`
				SELECT COALESCE(MAX(question_number), 0)::int AS max_num
				FROM survey_questions
				WHERE template_id = ${templateId}
			`;

			await sql`
				INSERT INTO survey_questions (template_id, question_number, question_text, question_type)
				VALUES (${templateId}, ${maxQ.max_num + 1}, ${question_text}, ${question_type})
			`;

			return { success: true, action: 'addQuestion' };
		} catch (error) {
			console.error('Error adding question:', error);
			return fail(500, { error: 'Failed to add question: ' + (error instanceof Error ? error.message : String(error)), action: 'addQuestion' });
		}
	},

	deleteQuestion: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'hsi', 'manager');
		const templateId = parseInt(params.template_id);
		const formData = await request.formData();
		const questionId = parseInt(formData.get('question_id')?.toString() || '0');

		if (!questionId) {
			return fail(400, { error: 'Invalid question ID.', action: 'deleteQuestion' });
		}

		try {
			await sql`
				DELETE FROM survey_questions
				WHERE question_id = ${questionId} AND template_id = ${templateId}
			`;

			// Re-number remaining questions
			const remaining = await sql`
				SELECT question_id FROM survey_questions
				WHERE template_id = ${templateId}
				ORDER BY question_number ASC
			`;

			for (let i = 0; i < remaining.length; i++) {
				await sql`
					UPDATE survey_questions
					SET question_number = ${i + 1}
					WHERE question_id = ${remaining[i].question_id}
				`;
			}

			return { success: true, action: 'deleteQuestion' };
		} catch (error) {
			console.error('Error deleting question:', error);
			return fail(500, { error: 'Failed to delete question.', action: 'deleteQuestion' });
		}
	},

	updateTemplate: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const templateId = parseInt(params.template_id);
		const formData = await request.formData();

		const template_name = formData.get('template_name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const is_active = formData.get('is_active') === 'true';

		if (!template_name) {
			return fail(400, { error: 'Template name is required.', action: 'updateTemplate' });
		}

		try {
			await sql`
				UPDATE survey_templates
				SET template_name = ${template_name},
					description = ${description},
					is_active = ${is_active}
				WHERE template_id = ${templateId}
			`;

			return { success: true, action: 'updateTemplate' };
		} catch (error) {
			console.error('Error updating template:', error);
			return fail(500, { error: 'Failed to update template.', action: 'updateTemplate' });
		}
	}
};
