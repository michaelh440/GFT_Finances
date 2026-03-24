// src/routes/hsi/tracks/[track_id]/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ params, locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');
	const trackId = parseInt(params.track_id);

	if (isNaN(trackId)) {
		return { track: null, classes: [], user: locals.user };
	}

	try {
		const [track] = await sql`
			SELECT track_id, track_name, description, sort_order, is_active, created_at, updated_at
			FROM class_tracks
			WHERE track_id = ${trackId}
		`;

		if (!track) {
			return { track: null, classes: [], user: locals.user };
		}

		const classes = await sql`
			SELECT
				c.class_code,
				c.class_name,
				c.class_type,
				c.student_type,
				c.standard_price,
				c.is_active,
				COUNT(DISTINCT cs.session_id)::int AS session_count,
				COUNT(DISTINCT r.registration_id)::int AS registration_count,
				COALESCE(SUM(r.amount_paid), 0)::numeric AS total_revenue
			FROM classes c
			LEFT JOIN class_sessions cs ON cs.class_code = c.class_code
			LEFT JOIN registrations r ON r.class_code = c.class_code
			WHERE c.track = ${track.track_name}
			GROUP BY c.class_code, c.class_name, c.class_type, c.student_type, c.standard_price, c.is_active
			ORDER BY c.is_active DESC, c.class_name ASC
		`;

		return {
			track,
			classes: classes.map(c => ({
				...c,
				standard_price: Number(c.standard_price),
				total_revenue: Number(c.total_revenue)
			})),
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading track:', error);
		return { track: null, classes: [], user: locals.user };
	}
};

export const actions = {
	default: async ({ request, params, locals }) => {
		requirePermission(locals.user, 'hsi', 'manager');
		const trackId = parseInt(params.track_id);
		const formData = await request.formData();

		const trackName = (formData.get('track_name') || '').toString().trim();
		const description = (formData.get('description') || '').toString().trim() || null;
		const sortOrder = parseInt((formData.get('sort_order') || '0').toString()) || 0;
		const isActive = formData.get('is_active') === 'on';

		if (!trackName) {
			return { success: false, error: 'Track name is required.' };
		}

		try {
			// Get old track name to update classes
			const [oldTrack] = await sql`
				SELECT track_name FROM class_tracks WHERE track_id = ${trackId}
			`;

			await sql`
				UPDATE class_tracks SET
					track_name = ${trackName},
					description = ${description},
					sort_order = ${sortOrder},
					is_active = ${isActive},
					updated_at = CURRENT_TIMESTAMP
				WHERE track_id = ${trackId}
			`;

			// If track name changed, update all classes referencing the old name
			if (oldTrack && oldTrack.track_name !== trackName) {
				await sql`
					UPDATE classes SET
						track = ${trackName},
						updated_at = CURRENT_TIMESTAMP
					WHERE track = ${oldTrack.track_name}
				`;
			}

			throw redirect(303, `/hsi/tracks/${trackId}`);
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;
			if (/** @type {any} */ (err).code === '23505') {
				return { success: false, error: 'A track with this name already exists.' };
			}
			console.error('Error updating track:', err);
			return { success: false, error: 'Failed to update track: ' + (err instanceof Error ? err.message : String(err)) };
		}
	}
};
