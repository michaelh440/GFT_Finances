// src/routes/hsi/classes/[class_code]/edit/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'hsi', 'data_entry');
	const { class_code } = params;

	try {
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
				is_active
			FROM classes
			WHERE class_code = ${class_code}
		`;

		if (!classInfo) {
			return { classInfo: null };
		}

		const workflowRows = await sql`
			SELECT category, value, label, sort_order
			FROM class_workflow
			WHERE is_active = true
			ORDER BY category, sort_order, label
		`.catch(() => []);

		const tracks = await sql`
			SELECT track_name FROM class_tracks
			WHERE is_active = true
			ORDER BY sort_order ASC, track_name ASC
		`.catch(() => []);

		return {
			classInfo: {
				...classInfo,
				standard_price: Number(classInfo.standard_price)
			},
			tracks,
			workflow: {
				class_types: workflowRows.filter(r => r.category === 'class_type'),
				student_types: workflowRows.filter(r => r.category === 'student_type'),
				duration_units: workflowRows.filter(r => r.category === 'duration_unit'),
			},
		};
	} catch (error) {
		console.error('Error loading class for edit:', error);
		return { classInfo: null };
	}
};

export const actions = {
	default: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const { class_code } = params;
		const formData = await request.formData();

		const class_name = formData.get('class_name')?.toString().trim();
		const class_type = formData.get('class_type')?.toString() || null;
		const student_type = formData.get('student_type')?.toString() || null;
		const standard_price = parseFloat(formData.get('standard_price')?.toString() || '0');
		const track = formData.get('track')?.toString().trim() || null;
		const vbo_event_id = formData.get('vbo_event_id')?.toString().trim() || null;
		const description = formData.get('description')?.toString().trim() || null;
		const duration_value_str = formData.get('duration_value')?.toString().trim();
		const duration_unit = formData.get('duration_unit')?.toString().trim() || null;
		const duration_value = duration_value_str ? parseInt(duration_value_str) : null;
		const is_active = formData.get('is_active') === 'true';

		// Validation
		if (!class_name) {
			return fail(400, {
				error: 'Class name is required.',
				values: { class_name, class_type, student_type, standard_price, track, vbo_event_id, description, duration_value, duration_unit, is_active }
			});
		}

		if (isNaN(standard_price) || standard_price < 0) {
			return fail(400, {
				error: 'Standard price must be a valid non-negative number.',
				values: { class_name, class_type, student_type, standard_price, track, vbo_event_id, description, duration_value, duration_unit, is_active }
			});
		}

		if ((duration_value && !duration_unit) || (!duration_value && duration_unit)) {
			return fail(400, {
				error: 'Duration value and unit must both be set or both be empty.',
				values: { class_name, class_type, student_type, standard_price, track, vbo_event_id, description, duration_value, duration_unit, is_active }
			});
		}

		try {
			await sql`
				UPDATE classes
				SET
					class_name = ${class_name},
					class_type = ${class_type},
					student_type = ${student_type},
					standard_price = ${standard_price},
					track = ${track},
					vbo_event_id = ${vbo_event_id},
					description = ${description},
					duration_value = ${duration_value},
					duration_unit = ${duration_unit},
					is_active = ${is_active},
					updated_at = CURRENT_TIMESTAMP
				WHERE class_code = ${class_code}
			`;
		} catch (error) {
			console.error('Error updating class:', error);

			if (/** @type {any} */ (error).code === '23505') {
				return fail(400, {
					error: 'A class with that name already exists.',
					values: { class_name, class_type, student_type, standard_price, track, vbo_event_id, description, duration_value, duration_unit, is_active }
				});
			}

			return fail(500, {
				error: 'An unexpected error occurred. Please try again.',
				values: { class_name, class_type, student_type, standard_price, track, vbo_event_id, description, duration_value, duration_unit, is_active }
			});
		}

		throw redirect(303, `/hsi/classes/${class_code}`);
	}
};