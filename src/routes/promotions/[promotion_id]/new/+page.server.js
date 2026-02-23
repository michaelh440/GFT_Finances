// src/routes/promotions/[promotion_id]/edit/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';

export const load = async ({ params }) => {
	const promotionId = parseInt(params.promotion_id);

	if (isNaN(promotionId)) {
		return { promotion: null, shows: [], linkedShowCodes: [] };
	}

	try {
		const [promotion] = await sql`
			SELECT promotion_id, promotion_name, description, discount_type,
				discount_value, start_date, end_date, is_active
			FROM promotions
			WHERE promotion_id = ${promotionId}
		`;

		if (!promotion) {
			return { promotion: null, shows: [], linkedShowCodes: [] };
		}

		const shows = await sql`
			SELECT show_code, show_name, format
			FROM shows WHERE is_active = true
			ORDER BY format ASC, show_name ASC
		`;

		const linkedShows = await sql`
			SELECT show_code FROM promotion_shows
			WHERE promotion_id = ${promotionId}
		`;

		return {
			promotion: {
				...promotion,
				discount_value: promotion.discount_value ? Number(promotion.discount_value) : null,
				start_date: promotion.start_date ? promotion.start_date.toISOString().split('T')[0] : '',
				end_date: promotion.end_date ? promotion.end_date.toISOString().split('T')[0] : ''
			},
			shows,
			linkedShowCodes: linkedShows.map((s) => s.show_code)
		};
	} catch (error) {
		console.error('Error loading promotion for edit:', error);
		return { promotion: null, shows: [], linkedShowCodes: [] };
	}
};

export const actions = {
	default: async ({ request, params }) => {
		const promotionId = parseInt(params.promotion_id);
		const formData = await request.formData();

		const promotion_name = (formData.get('promotion_name') || '').toString().trim();
		const description = (formData.get('description') || '').toString().trim() || null;
		const discount_type = (formData.get('discount_type') || '').toString() || null;
		const discount_value = formData.get('discount_value')?.toString().trim();
		const start_date = (formData.get('start_date') || '').toString().trim() || null;
		const end_date = (formData.get('end_date') || '').toString().trim() || null;
		const is_active = formData.get('is_active') === 'true';
		const show_codes = formData.getAll('show_codes').map((s) => s.toString());

		if (!promotion_name) {
			return fail(400, { error: 'Promotion name is required.' });
		}

		const parsedValue = discount_value ? parseFloat(discount_value) : null;

		try {
			await sql`
				UPDATE promotions SET
					promotion_name = ${promotion_name},
					description = ${description},
					discount_type = ${discount_type},
					discount_value = ${parsedValue},
					start_date = ${start_date},
					end_date = ${end_date},
					is_active = ${is_active},
					updated_at = CURRENT_TIMESTAMP
				WHERE promotion_id = ${promotionId}
			`;

			// Update linked shows: delete all, re-insert
			await sql`DELETE FROM promotion_shows WHERE promotion_id = ${promotionId}`;
			for (const code of show_codes) {
				if (code) {
					await sql`
						INSERT INTO promotion_shows (promotion_id, show_code)
						VALUES (${promotionId}, ${code})
						ON CONFLICT DO NOTHING
					`;
				}
			}

			throw redirect(303, `/promotions/${promotionId}`);
		} catch (err) {
			if (err.status === 303) throw err;
			console.error('Error updating promotion:', err);
			return fail(500, { error: 'Failed to update promotion: ' + err.message });
		}
	}
};