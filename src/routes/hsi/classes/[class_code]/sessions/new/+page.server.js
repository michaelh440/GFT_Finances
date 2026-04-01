// src/routes/hsi/classes/[class_code]/sessions/new/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'hsi', 'data_entry');
	const { class_code } = params;

	try {
		const [classInfo] = await sql`
			SELECT class_code, class_name, track, duration_value, duration_unit
			FROM classes
			WHERE class_code = ${class_code}
		`;

		if (!classInfo) {
			return { classInfo: null };
		}

		const [teachers, durationUnits] = await Promise.all([
			sql`
				SELECT teacher_id, first_name, last_name
				FROM teachers
				WHERE is_active = true
				ORDER BY last_name ASC, first_name ASC
			`,
			sql`
				SELECT value, label FROM class_workflow
				WHERE category = 'duration_unit' AND is_active = true
				ORDER BY sort_order, label
			`.catch(() => []),
		]);

		return {
			classInfo: {
				...classInfo,
				duration_value: classInfo.duration_value ? Number(classInfo.duration_value) : null,
			},
			teachers,
			durationUnits,
			user: locals.user,
		};
	} catch (error) {
		console.error('Error loading class for new session:', error);
		return { classInfo: null };
	}
};

export const actions = {
	default: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const { class_code } = params;
		const formData = await request.formData();

		const sessionName = (formData.get('session_name') || '').toString().trim();
		const startDate = (formData.get('start_date') || '').toString().trim() || null;
		const endDate = (formData.get('end_date') || '').toString().trim() || null;
		const teacherIdStr = (formData.get('teacher_id') || '').toString().trim();
		const teacherId = teacherIdStr ? parseInt(teacherIdStr) : null;
		const location = (formData.get('location') || '').toString().trim() || null;
		const startTime = (formData.get('start_time') || '').toString().trim() || null;
		const endTime = (formData.get('end_time') || '').toString().trim() || null;
		const durationValueStr = (formData.get('duration_value') || '').toString().trim();
		const durationUnit = (formData.get('duration_unit') || '').toString().trim() || null;
		const durationValue = durationValueStr ? parseInt(durationValueStr) : null;
		const price = (formData.get('price') || '').toString().trim();
		const sessionPrice = price ? parseFloat(price) : null;

		if (!sessionName) {
			return { success: false, error: 'Session name is required.' };
		}

		if ((durationValue && !durationUnit) || (!durationValue && durationUnit)) {
			return { success: false, error: 'Duration value and unit must both be set or both be empty.' };
		}

		if (teacherId) {
			const [teacher] = await sql`
				SELECT teacher_id FROM teachers
				WHERE teacher_id = ${teacherId} AND is_active = true
			`;
			if (!teacher) {
				return { success: false, error: 'Selected teacher is not an active teacher.' };
			}
		}

		try {
			const [newSession] = await sql`
				INSERT INTO class_sessions (
					class_code, session_name, start_date, end_date,
					start_time, end_time,
					teacher_id, location, duration_value, duration_unit,
					price, is_active
				) VALUES (
					${class_code}, ${sessionName}, ${startDate}, ${endDate},
					${startTime}, ${endTime},
					${teacherId}, ${location}, ${durationValue}, ${durationUnit},
					${sessionPrice}, true
				)
				RETURNING session_id
			`;

			throw redirect(303, `/hsi/classes/${class_code}/sessions/${newSession.session_id}`);
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;
			console.error('Error creating session:', err);
			return { success: false, error: 'Failed to create session: ' + (err instanceof Error ? err.message : String(err)) };
		}
	}
};
