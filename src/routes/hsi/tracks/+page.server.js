// src/routes/hsi/tracks/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');

	try {
		// Ensure class_tracks table exists
		await sql`
			CREATE TABLE IF NOT EXISTS class_tracks (
				track_id SERIAL PRIMARY KEY,
				track_name TEXT NOT NULL UNIQUE,
				description TEXT,
				sort_order INTEGER DEFAULT 0,
				is_active BOOLEAN DEFAULT true,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`;

		// Seed any tracks from classes table that don't exist yet
		await sql`
			INSERT INTO class_tracks (track_name)
			SELECT DISTINCT track FROM classes
			WHERE track IS NOT NULL AND TRIM(track) != ''
			ON CONFLICT (track_name) DO NOTHING
		`;

		// Load tracks with class counts
		const tracks = await sql`
			SELECT
				t.track_id,
				t.track_name,
				t.description,
				t.sort_order,
				t.is_active,
				t.created_at,
				COUNT(DISTINCT c.class_code)::int AS class_count,
				COUNT(DISTINCT CASE WHEN c.is_active THEN c.class_code END)::int AS active_class_count
			FROM class_tracks t
			LEFT JOIN classes c ON c.track = t.track_name
			GROUP BY t.track_id
			ORDER BY t.sort_order ASC, t.track_name ASC
		`;

		return {
			tracks,
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading tracks:', error);
		return { tracks: [], user: locals.user };
	}
};
