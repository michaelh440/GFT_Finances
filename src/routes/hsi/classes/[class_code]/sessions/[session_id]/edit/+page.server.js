// src/routes/hsi/classes/[class_code]/sessions/[session_id]/edit/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'hsi', 'data_entry');
	const { class_code, session_id } = params;

	try {
		const [classInfo] = await sql`
			SELECT class_code, class_name, track, duration_value, duration_unit
			FROM classes
			WHERE class_code = ${class_code}
		`;

		if (!classInfo) {
			return { classInfo: null, session: null };
		}

		const [session] = await sql`
			SELECT session_id, session_name, class_code, start_date, end_date,
				instructor, location, duration_value, duration_unit, is_active
			FROM class_sessions
			WHERE session_id = ${session_id}
				AND class_code = ${class_code}
		`;

		const teachers = await sql`
			SELECT teacher_id, first_name, last_name
			FROM teachers
			WHERE is_active = true
			ORDER BY last_name ASC, first_name ASC
		`;

		return {
			classInfo: classInfo || null,
			session: session ? {
				...session,
				start_date: session.start_date ? session.start_date.toISOString().split('T')[0] : null,
				end_date: session.end_date ? session.end_date.toISOString().split('T')[0] : null
			} : null,
			teachers,
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading session for edit:', error);
		return { classInfo: null, session: null };
	}
};

export const actions = {
	default: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const { class_code, session_id } = params;
		const formData = await request.formData();

		const sessionName = (formData.get('session_name') || '').toString().trim();
		const startDate = (formData.get('start_date') || '').toString().trim() || null;
		const endDate = (formData.get('end_date') || '').toString().trim() || null;
		const instructor = (formData.get('instructor') || '').toString().trim() || null;
		const location = (formData.get('location') || '').toString().trim() || null;
		const durationValueStr = (formData.get('duration_value') || '').toString().trim();
		const durationUnit = (formData.get('duration_unit') || '').toString().trim() || null;
		const durationValue = durationValueStr ? parseInt(durationValueStr) : null;
		const isActive = formData.get('is_active') === 'on';

		if (!sessionName) {
			return { success: false, error: 'Session name is required.' };
		}

		if ((durationValue && !durationUnit) || (!durationValue && durationUnit)) {
			return { success: false, error: 'Duration value and unit must both be set or both be empty.' };
		}

		// Validate instructor is an active teacher
		if (instructor) {
			const [teacher] = await sql`
				SELECT teacher_id FROM teachers
				WHERE CONCAT(first_name, ' ', last_name) = ${instructor}
					AND is_active = true
			`;
			if (!teacher) {
				return { success: false, error: 'Selected instructor is not an active teacher.' };
			}
		}

		try {
			await sql`
				UPDATE class_sessions SET
					session_name = ${sessionName},
					start_date = ${startDate},
					end_date = ${endDate},
					instructor = ${instructor},
					location = ${location},
					duration_value = ${durationValue},
					duration_unit = ${durationUnit},
					is_active = ${isActive},
					updated_at = CURRENT_TIMESTAMP
				WHERE session_id = ${session_id}
					AND class_code = ${class_code}
			`;

			throw redirect(303, `/hsi/classes/${class_code}/sessions/${session_id}`);
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;
			console.error('Error updating session:', err);
			return { success: false, error: 'Failed to update session: ' + (err instanceof Error ? err.message : String(err)) };
		}
	}
};
