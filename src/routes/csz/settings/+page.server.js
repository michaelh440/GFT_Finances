// src/routes/csz/settings/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'csz', 'manager');

	// Auto-create mapping table
	await sql`
		CREATE TABLE IF NOT EXISTS csz_show_mapping (
			show_code TEXT PRIMARY KEY REFERENCES shows(show_code),
			added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`;

	try {
		// All active shows
		const allShows = await sql`
			SELECT show_code, show_name, format, audience_type, day_of_week, is_active
			FROM shows
			ORDER BY format ASC, show_name ASC
		`;

		// Currently selected CSZ shows
		const selected = await sql`
			SELECT show_code FROM csz_show_mapping
		`;
		const selectedCodes = new Set(selected.map(r => r.show_code));

		return {
			shows: allShows.map(s => ({
				...s,
				selected: selectedCodes.has(s.show_code)
			})),
			user: locals.user
		};
	} catch (error) {
		console.error('Error loading CSZ settings:', error);
		return { shows: [], user: locals.user };
	}
};

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'csz', 'manager');
		const formData = await request.formData();
		const showCodes = formData.getAll('show_codes').map(v => v.toString());

		try {
			// Clear existing and re-insert selected
			await sql`DELETE FROM csz_show_mapping`;

			if (showCodes.length > 0) {
				const rows = showCodes.map(code => ({ show_code: code }));
				await sql`
					INSERT INTO csz_show_mapping ${sql(rows, 'show_code')}
				`;
			}

			throw redirect(303, '/csz/settings');
		} catch (err) {
			if (/** @type {any} */ (err).status === 303) throw err;
			console.error('Error saving CSZ settings:', err);
			return { success: false, error: 'Failed to save settings: ' + (err instanceof Error ? err.message : String(err)) };
		}
	}
};
