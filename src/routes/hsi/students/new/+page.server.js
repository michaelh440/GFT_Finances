// src/routes/hsi/students/new/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'data_entry');
	return { user: locals.user };
};

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'hsi', 'data_entry');
		const formData = await request.formData();
		const count = parseInt(formData.get('student_count')?.toString() || '1');

		/** @type {any[]} */
		const results = [];
		let created = 0;
		let skipped = 0;
		let duplicates = 0;

		for (let i = 0; i < count; i++) {
			const firstName = (formData.get(`first_name_${i}`) || '').toString().trim();
			const lastName = (formData.get(`last_name_${i}`) || '').toString().trim();
			const email = (formData.get(`email_${i}`) || '').toString().trim().toLowerCase();
			const phone = (formData.get(`phone_${i}`) || '').toString().trim() || null;
			const mobilePhone = (formData.get(`mobile_phone_${i}`) || '').toString().trim() || null;

			if (!firstName || !lastName) {
				if (firstName || lastName || email) {
					skipped++;
					results.push({ name: `${firstName} ${lastName}`.trim() || '(unnamed)', status: 'skipped', reason: 'First and last name required' });
				}
				continue;
			}

			// Check for duplicates by email or name
			if (email) {
				const existing = await sql`
					SELECT student_id FROM students
					WHERE LOWER(TRIM(email)) = ${email}
					LIMIT 1
				`;
				if (existing.length > 0) {
					duplicates++;
					results.push({ name: `${firstName} ${lastName}`, status: 'duplicate', reason: 'Email already exists' });
					continue;
				}
			} else {
				const existing = await sql`
					SELECT student_id FROM students
					WHERE LOWER(TRIM(first_name)) = ${firstName.toLowerCase()}
					  AND LOWER(TRIM(last_name)) = ${lastName.toLowerCase()}
					LIMIT 1
				`;
				if (existing.length > 0) {
					duplicates++;
					results.push({ name: `${firstName} ${lastName}`, status: 'duplicate', reason: 'Name already exists' });
					continue;
				}
			}

			try {
				await sql`
					INSERT INTO students (first_name, last_name, email, phone, mobile_phone, account_date, is_active)
					VALUES (${firstName}, ${lastName}, ${email || null}, ${phone}, ${mobilePhone}, CURRENT_DATE, true)
				`;
				created++;
				results.push({ name: `${firstName} ${lastName}`, status: 'created' });
			} catch (err) {
				if (/** @type {any} */ (err).code === '23505') {
					duplicates++;
					results.push({ name: `${firstName} ${lastName}`, status: 'duplicate', reason: 'Already exists' });
				} else {
					results.push({ name: `${firstName} ${lastName}`, status: 'error', reason: /** @type {Error} */ (err).message });
				}
			}
		}

		// If only one student was added successfully, redirect to students list
		if (created === 1 && count === 1) {
			throw redirect(303, '/hsi/students');
		}

		return {
			success: true,
			created,
			skipped,
			duplicates,
			results,
			message: `Created ${created} student${created !== 1 ? 's' : ''}${duplicates > 0 ? `, ${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped` : ''}${skipped > 0 ? `, ${skipped} incomplete row${skipped !== 1 ? 's' : ''} skipped` : ''}.`
		};
	}
};
