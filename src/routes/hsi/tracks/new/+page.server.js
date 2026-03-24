// src/routes/hsi/tracks/new/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'manager');
	return { user: locals.user };
};

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'hsi', 'manager');
		const formData = await request.formData();

		const trackName = (formData.get('track_name') || '').toString().trim();
		const description = (formData.get('description') || '').toString().trim() || null;
		const sortOrder = parseInt((formData.get('sort_order') || '0').toString()) || 0;
		const isActive = formData.get('is_active') === 'on';

		if (!trackName) {
			return { success: false, error: 'Track name is required.' };
		}

		try {
			const [created] = await sql`
				INSERT INTO class_tracks (track_name, description, sort_order, is_active)
				VALUES (${trackName}, ${description}, ${sortOrder}, ${isActive})
				RETURNING track_id
			`;

			throw redirect(303, `/hsi/tracks/${created.track_id}`);
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;
			if (/** @type {any} */ (err).code === '23505') {
				return { success: false, error: 'A track with this name already exists.' };
			}
			console.error('Error creating track:', err);
			return { success: false, error: 'Failed to create track: ' + (err instanceof Error ? err.message : String(err)) };
		}
	}
};
