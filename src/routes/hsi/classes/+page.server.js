// src/routes/hsi/classes/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');
	try {
		const classes = await sql`
      SELECT 
        class_code,
        class_name,
        class_type,
        student_type,
        standard_price,
        track,
        description,
        duration_value,
        duration_unit,
        is_active,
        created_at,
        updated_at
      FROM classes
      ORDER BY 
        is_active DESC,
        track ASC,
        class_name ASC
    `;

		return {
			classes: classes.map((c) => ({
				...c,
				standard_price: Number(c.standard_price)
			})),
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading classes:', error);
		return {
			classes: []
		};
	}
};
