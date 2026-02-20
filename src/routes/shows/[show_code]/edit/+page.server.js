// src/routes/shows/[show_code]/edit/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';

export const load = async ({ params }) => {
	const { show_code } = params;

	try {
		const [showInfo] = await sql`
			SELECT 
				show_code,
				show_name,
				format,
				audience_type,
				day_of_week,
				standard_ticket_price,
				description,
				is_active
			FROM shows
			WHERE show_code = ${show_code}
		`;

		if (!showInfo) {
			return { showInfo: null };
		}

		return {
			showInfo: {
				...showInfo,
				standard_ticket_price: Number(showInfo.standard_ticket_price || 0)
			}
		};
	} catch (error) {
		console.error('Error loading show for edit:', error);
		return { showInfo: null };
	}
};

export const actions = {
	default: async ({ request, params }) => {
		const { show_code } = params;
		const formData = await request.formData();

		const show_name = formData.get('show_name')?.toString().trim();
		const format = formData.get('format')?.toString().trim() || null;
		const audience_type = formData.get('audience_type')?.toString() || null;
		const day_of_week = formData.get('day_of_week')?.toString() || null;
		const standard_ticket_price = parseFloat(formData.get('standard_ticket_price')?.toString() || '0');
		const description = formData.get('description')?.toString().trim() || null;
		const is_active = formData.get('is_active') === 'true';

		// Validation
		if (!show_name) {
			return fail(400, {
				error: 'Show name is required.',
				values: { show_name, format, audience_type, day_of_week, standard_ticket_price, description, is_active }
			});
		}

		if (isNaN(standard_ticket_price) || standard_ticket_price < 0) {
			return fail(400, {
				error: 'Ticket price must be a valid non-negative number.',
				values: { show_name, format, audience_type, day_of_week, standard_ticket_price, description, is_active }
			});
		}

		try {
			await sql`
				UPDATE shows
				SET
					show_name = ${show_name},
					format = ${format},
					audience_type = ${audience_type},
					day_of_week = ${day_of_week},
					standard_ticket_price = ${standard_ticket_price},
					description = ${description},
					is_active = ${is_active},
					updated_at = CURRENT_TIMESTAMP
				WHERE show_code = ${show_code}
			`;
		} catch (error) {
			console.error('Error updating show:', error);

			if (error.code === '23505') {
				return fail(400, {
					error: 'A show with that name already exists.',
					values: { show_name, format, audience_type, day_of_week, standard_ticket_price, description, is_active }
				});
			}

			return fail(500, {
				error: 'An unexpected error occurred. Please try again.',
				values: { show_name, format, audience_type, day_of_week, standard_ticket_price, description, is_active }
			});
		}

		throw redirect(303, `/shows/${show_code}`);
	}
};