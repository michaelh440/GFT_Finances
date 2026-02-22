// src/routes/shows/tickets/new/+page.server.js
import sql from '$lib/db';
import { fail, redirect } from '@sveltejs/kit';

export const load = async () => {
	try {
		const shows = await sql`
			SELECT show_code, show_name, format, standard_ticket_price
			FROM shows
			WHERE is_active = true
			ORDER BY format ASC, show_name ASC
		`;

		const patrons = await sql`
			SELECT patron_id, first_name, last_name, email
			FROM patrons
			WHERE is_active = true
			ORDER BY last_name ASC, first_name ASC
		`;

		return {
			shows: shows.map((s) => ({
				...s,
				standard_ticket_price: Number(s.standard_ticket_price || 0)
			})),
			patrons
		};
	} catch (error) {
		console.error('Error loading ticket form data:', error);
		return { shows: [], patrons: [] };
	}
};

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const patron_id = parseInt(formData.get('patron_id')?.toString() || '0');
		const show_code = formData.get('show_code')?.toString();
		const show_date = formData.get('show_date')?.toString();
		const tickets_purchased = parseInt(formData.get('tickets_purchased')?.toString() || '1');
		const amount_paid = parseFloat(formData.get('amount_paid')?.toString() || '0');
		const purchase_date = formData.get('purchase_date')?.toString() || null;
		const payment_method = formData.get('payment_method')?.toString() || null;
		const notes = formData.get('notes')?.toString().trim() || null;

		if (!patron_id || !show_code || !show_date) {
			return fail(400, {
				error: 'Patron, show, and show date are required.',
				values: { patron_id, show_code, show_date, tickets_purchased, amount_paid, purchase_date, payment_method, notes }
			});
		}

		if (tickets_purchased < 1) {
			return fail(400, {
				error: 'Tickets purchased must be at least 1.',
				values: { patron_id, show_code, show_date, tickets_purchased, amount_paid, purchase_date, payment_method, notes }
			});
		}

		try {
			await sql`
				INSERT INTO show_tickets (
					patron_id, show_code, show_date, tickets_purchased,
					amount_paid, purchase_date, payment_method, notes
				) VALUES (
					${patron_id}, ${show_code}, ${show_date}, ${tickets_purchased},
					${amount_paid}, ${purchase_date}, ${payment_method}, ${notes}
				)
			`;
		} catch (error) {
			console.error('Error saving ticket purchase:', error);
			return fail(500, {
				error: 'An unexpected error occurred. Please try again.',
				values: { patron_id, show_code, show_date, tickets_purchased, amount_paid, purchase_date, payment_method, notes }
			});
		}

		throw redirect(303, `/shows/patrons/${patron_id}`);
	}
};