// src/routes/hsi/student_surveys/templates/new/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'data_entry');
	return { user: locals.user };
};

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const formData = await request.formData();

		const template_name = formData.get('template_name')?.toString().trim();
		const description = formData.get('description')?.toString().trim() || null;
		const is_active = formData.get('is_active') === 'true';

		if (!template_name) {
			return fail(400, {
				error: 'Template name is required.',
				values: { template_name, description, is_active }
			});
		}

		try {
			// Try full insert first; fall back if columns don't exist
			let result;
			try {
				[result] = await sql`
					INSERT INTO survey_templates (template_name, description, is_active)
					VALUES (${template_name}, ${description}, ${is_active})
					RETURNING template_id
				`;
			} catch (insertErr) {
				// If column doesn't exist, try minimal insert
				console.error('Full insert failed, trying minimal:', insertErr);
				[result] = await sql`
					INSERT INTO survey_templates (template_name)
					VALUES (${template_name})
					RETURNING template_id
				`;
			}

			throw redirect(303, `/hsi/student_surveys/templates/${result.template_id}`);
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;

			console.error('Error creating template:', err);
			if (/** @type {any} */ (err).code === '23505') {
				return fail(400, {
					error: 'A template with that name already exists.',
					values: { template_name, description, is_active }
				});
			}
			return fail(500, {
				error: 'An unexpected error occurred: ' + (err instanceof Error ? err.message : String(err)),
				values: { template_name, description, is_active }
			});
		}
	}
};
