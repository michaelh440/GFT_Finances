// src/routes/shows/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'gft', 'viewer');
	try {
		const shows = await sql`
      SELECT 
        show_code,
        show_name,
        format,
        audience_type,
        day_of_week,
        standard_ticket_price,
        description,
        is_active,
        created_at,
        updated_at
      FROM shows
      ORDER BY 
        is_active DESC,
        format ASC,
        show_name ASC
    `;

		return {
			shows: shows.map((s) => ({
				...s,
				standard_ticket_price: Number(s.standard_ticket_price || 0)
			})),
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading shows:', error);
		return {
			shows: []
		};
	}
};
