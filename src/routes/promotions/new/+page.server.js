// src/routes/promotions/new/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';

export const load = async () => {
	try {
		const shows = await sql`
			SELECT show_code, show_name, format
			FROM shows WHERE is_active = true
			ORDER BY format ASC, show_name ASC
		`;
		const classes = await sql`
			SELECT class_code, class_name, track
			FROM classes WHERE is_active = true
			ORDER BY track ASC, class_name ASC
		`;
		return { shows, classes };
	} catch (error) {
		console.error('Error loading data:', error);
		return { shows: [], classes: [] };
	}
};

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const promotion_name = (formData.get('promotion_name') || '').toString().trim();
		const description = (formData.get('description') || '').toString().trim() || null;
		const discount_type = (formData.get('discount_type') || '').toString() || null;
		const discount_value = formData.get('discount_value')?.toString().trim();
		const start_date = (formData.get('start_date') || '').toString().trim() || null;
		const end_date = (formData.get('end_date') || '').toString().trim() || null;
		const show_codes = formData.getAll('show_codes').map((s) => s.toString());
		const class_codes = formData.getAll('class_codes').map((s) => s.toString());

		if (!promotion_name) {
			return fail(400, { error: 'Promotion name is required.' });
		}

		const parsedValue = discount_value ? parseFloat(discount_value) : null;

		try {
			const [newPromo] = await sql`
				INSERT INTO promotions (promotion_name, description, discount_type, discount_value, start_date, end_date)
				VALUES (${promotion_name}, ${description}, ${discount_type}, ${parsedValue}, ${start_date}, ${end_date})
				RETURNING promotion_id
			`;

			// Link shows
			for (const code of show_codes) {
				if (code) {
					await sql`
						INSERT INTO promotion_shows (promotion_id, show_code)
						VALUES (${newPromo.promotion_id}, ${code})
						ON CONFLICT DO NOTHING
					`;
				}
			}

			// Link classes
			for (const code of class_codes) {
				if (code) {
					await sql`
						INSERT INTO promotion_classes (promotion_id, class_code)
						VALUES (${newPromo.promotion_id}, ${code})
						ON CONFLICT DO NOTHING
					`;
				}
			}

			throw redirect(303, `/promotions/${newPromo.promotion_id}`);
		} catch (err) {
			if (err.status === 303) throw err;
			console.error('Error creating promotion:', err);
			return fail(500, { error: 'Failed to create promotion: ' + err.message });
		}
	}
};