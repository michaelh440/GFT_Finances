// src/routes/admin/tools/state_standardization/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { standardizeState, isStandardState } from '$lib/states';

/** @param {string} s */
function suggestStandard(s) {
	const std = standardizeState(s);
	return (std && std !== s.trim()) ? std : (isStandardState(std) ? std : null);
}

export const load = async ({ locals }) => {
	if (!locals.user?.is_super_admin) {
		throw redirect(303, '/');
	}

	try {
		// Get non-standard states from students
		const studentStates = await sql`
			SELECT student_id, first_name, last_name, state, city
			FROM students
			WHERE state IS NOT NULL AND state != ''
			  AND state !~ '^[A-Z]{2}$'
			ORDER BY state ASC, last_name ASC
		`;

		// Get non-standard states from patrons
		const patronStates = await sql`
			SELECT patron_id, first_name, last_name, state, city
			FROM patrons
			WHERE state IS NOT NULL AND state != ''
			  AND state !~ '^[A-Z]{2}$'
			ORDER BY state ASC, last_name ASC
		`;

		// Get non-standard states from corp_contacts
		const contactStates = await sql`
			SELECT corp_contact_id, first_name, last_name, company_name, state, city
			FROM corp_contacts
			WHERE state IS NOT NULL AND state != ''
			  AND state !~ '^[A-Z]{2}$'
			ORDER BY state ASC, last_name ASC
		`;

		return {
			students: studentStates.map((s) => ({
				...s,
				suggested: suggestStandard(s.state)
			})),
			patrons: patronStates.map((p) => ({
				...p,
				suggested: suggestStandard(p.state)
			})),
			contacts: contactStates.map((c) => ({
				...c,
				suggested: suggestStandard(c.state)
			})),
		};
	} catch (error) {
		console.error('Error loading state data:', error);
		return { students: [], patrons: [], contacts: [] };
	}
};

export const actions = {
	update: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) {
			throw redirect(303, '/');
		}

		const formData = await request.formData();
		const updatesJson = formData.get('updates')?.toString() || '[]';

		try {
			const updates = JSON.parse(updatesJson);
			let updated = 0;

			for (const u of updates) {
				const newState = (u.new_state || '').trim().toUpperCase();
				if (!newState || !isStandardState(newState)) continue;

				if (u.table === 'students') {
					await sql`UPDATE students SET state = ${newState}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${u.id}`;
					updated++;
				} else if (u.table === 'patrons') {
					await sql`UPDATE patrons SET state = ${newState}, updated_at = CURRENT_TIMESTAMP WHERE patron_id = ${u.id}`;
					updated++;
				} else if (u.table === 'corp_contacts') {
					await sql`UPDATE corp_contacts SET state = ${newState} WHERE corp_contact_id = ${u.id}`;
					updated++;
				}
			}

			return { success: true, message: `Updated ${updated} record${updated !== 1 ? 's' : ''}.` };
		} catch (error) {
			console.error('Error updating states:', error);
			return { success: false, error: 'Failed to update: ' + /** @type {Error} */ (error).message };
		}
	},

	auto_fix: async ({ locals }) => {
		if (!locals.user?.is_super_admin) {
			throw redirect(303, '/');
		}

		try {
			let fixed = 0;

			// Auto-fix students
			const students = await sql`
				SELECT student_id, state FROM students
				WHERE state IS NOT NULL AND state != '' AND state !~ '^[A-Z]{2}$'
			`;
			for (const s of students) {
				const std = suggestStandard(s.state);
				if (std) {
					await sql`UPDATE students SET state = ${std}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${s.student_id}`;
					fixed++;
				}
			}

			// Auto-fix patrons
			const patrons = await sql`
				SELECT patron_id, state FROM patrons
				WHERE state IS NOT NULL AND state != '' AND state !~ '^[A-Z]{2}$'
			`;
			for (const p of patrons) {
				const std = suggestStandard(p.state);
				if (std) {
					await sql`UPDATE patrons SET state = ${std}, updated_at = CURRENT_TIMESTAMP WHERE patron_id = ${p.patron_id}`;
					fixed++;
				}
			}

			// Auto-fix corp_contacts
			const contacts = await sql`
				SELECT corp_contact_id, state FROM corp_contacts
				WHERE state IS NOT NULL AND state != '' AND state !~ '^[A-Z]{2}$'
			`;
			for (const c of contacts) {
				const std = suggestStandard(c.state);
				if (std) {
					await sql`UPDATE corp_contacts SET state = ${std} WHERE corp_contact_id = ${c.corp_contact_id}`;
					fixed++;
				}
			}

			return { success: true, message: `Auto-fixed ${fixed} record${fixed !== 1 ? 's' : ''} across all tables.` };
		} catch (error) {
			console.error('Error auto-fixing states:', error);
			return { success: false, error: 'Failed to auto-fix: ' + /** @type {Error} */ (error).message };
		}
	}
};
