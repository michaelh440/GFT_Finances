// src/routes/admin/tools/bi_directional_vbo_sync/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';

const SHARED_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'mobile_phone', 'vbo_account_id', 'address_line1', 'address_line2', 'city', 'state', 'zip_code', 'country'];

const SHARED_COLS = SHARED_FIELDS.join(', ');

export const load = async ({ locals, url }) => {
	if (!locals.user?.is_super_admin) {
		throw redirect(303, '/');
	}

	const skippedParam = url.searchParams.get('skipped') || '';
	/** @type {number[][]} */
	const skippedPairs = skippedParam
		? skippedParam.split(',').map(p => p.split('-').map(Number)).filter(p => p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]))
		: [];

	try {
		const [stats] = await sql`
			SELECT
				(SELECT COUNT(*) FROM students) AS students_total,
				(SELECT COUNT(*) FROM students WHERE vbo_account_id IS NOT NULL AND TRIM(vbo_account_id) != '') AS students_with_vbo,
				(SELECT COUNT(*) FROM patrons) AS patrons_total,
				(SELECT COUNT(*) FROM patrons WHERE vbo_account_id IS NOT NULL AND TRIM(vbo_account_id) != '') AS patrons_with_vbo
		`;

		const skippedStudentIds = skippedPairs.map(p => p[0]);
		const skippedPatronIds = skippedPairs.map(p => p[1]);

		let currentPair = null;

		// 1. Try email match — fetch all shared fields
		const [emailMatch] = await sql`
			SELECT s.student_id,
			       s.first_name AS s_first_name, s.last_name AS s_last_name, s.email AS s_email,
			       s.phone AS s_phone, s.mobile_phone AS s_mobile_phone, s.vbo_account_id AS s_vbo_account_id,
			       s.address_line1 AS s_address_line1, s.address_line2 AS s_address_line2,
			       s.city AS s_city, s.state AS s_state, s.zip_code AS s_zip_code, s.country AS s_country,
			       p.patron_id,
			       p.first_name AS p_first_name, p.last_name AS p_last_name, p.email AS p_email,
			       p.phone AS p_phone, p.mobile_phone AS p_mobile_phone, p.vbo_account_id AS p_vbo_account_id,
			       p.address_line1 AS p_address_line1, p.address_line2 AS p_address_line2,
			       p.city AS p_city, p.state AS p_state, p.zip_code AS p_zip_code, p.country AS p_country
			FROM students s
			JOIN patrons p ON LOWER(TRIM(s.email)) = LOWER(TRIM(p.email))
			WHERE TRIM(s.email) != ''
			  AND (
			    (s.vbo_account_id IS NOT NULL AND TRIM(s.vbo_account_id) != '' AND (p.vbo_account_id IS NULL OR TRIM(p.vbo_account_id) = '' OR p.vbo_account_id != s.vbo_account_id))
			    OR
			    (p.vbo_account_id IS NOT NULL AND TRIM(p.vbo_account_id) != '' AND (s.vbo_account_id IS NULL OR TRIM(s.vbo_account_id) = '' OR s.vbo_account_id != p.vbo_account_id))
			  )
			  AND NOT (s.student_id = ANY(${skippedStudentIds}) AND p.patron_id = ANY(${skippedPatronIds}))
			LIMIT 1
		`;

		if (emailMatch) {
			currentPair = buildPair(emailMatch, 'email');
		}

		// 2. Name match fallback
		if (!currentPair) {
			const [nameMatch] = await sql`
				SELECT s.student_id,
				       s.first_name AS s_first_name, s.last_name AS s_last_name, s.email AS s_email,
				       s.phone AS s_phone, s.mobile_phone AS s_mobile_phone, s.vbo_account_id AS s_vbo_account_id,
				       s.address_line1 AS s_address_line1, s.address_line2 AS s_address_line2,
				       s.city AS s_city, s.state AS s_state, s.zip_code AS s_zip_code, s.country AS s_country,
				       p.patron_id,
				       p.first_name AS p_first_name, p.last_name AS p_last_name, p.email AS p_email,
				       p.phone AS p_phone, p.mobile_phone AS p_mobile_phone, p.vbo_account_id AS p_vbo_account_id,
				       p.address_line1 AS p_address_line1, p.address_line2 AS p_address_line2,
				       p.city AS p_city, p.state AS p_state, p.zip_code AS p_zip_code, p.country AS p_country
				FROM students s
				JOIN patrons p ON LOWER(TRIM(s.first_name)) = LOWER(TRIM(p.first_name))
				                AND LOWER(TRIM(s.last_name)) = LOWER(TRIM(p.last_name))
				WHERE TRIM(s.first_name) != '' AND TRIM(s.last_name) != ''
				  AND (
				    (s.vbo_account_id IS NOT NULL AND TRIM(s.vbo_account_id) != '' AND (p.vbo_account_id IS NULL OR TRIM(p.vbo_account_id) = '' OR p.vbo_account_id != s.vbo_account_id))
				    OR
				    (p.vbo_account_id IS NOT NULL AND TRIM(p.vbo_account_id) != '' AND (s.vbo_account_id IS NULL OR TRIM(s.vbo_account_id) = '' OR s.vbo_account_id != p.vbo_account_id))
				  )
				  AND NOT (s.student_id = ANY(${skippedStudentIds}) AND p.patron_id = ANY(${skippedPatronIds}))
				LIMIT 1
			`;

			if (nameMatch) {
				currentPair = buildPair(nameMatch, 'name');
			}
		}

		return {
			stats: {
				studentsTotal: Number(stats.students_total),
				studentsWithVbo: Number(stats.students_with_vbo),
				patronsTotal: Number(stats.patrons_total),
				patronsWithVbo: Number(stats.patrons_with_vbo),
			},
			currentPair,
			skippedParam,
		};
	} catch (error) {
		console.error('Error loading VBO sync data:', error);
		return {
			stats: { studentsTotal: 0, studentsWithVbo: 0, patronsTotal: 0, patronsWithVbo: 0 },
			currentPair: null,
			skippedParam: '',
		};
	}
};

/** @param {any} r @param {string} matchType */
function buildPair(r, matchType) {
	/** @type {Record<string, any>} */
	const student = { student_id: r.student_id };
	/** @type {Record<string, any>} */
	const patron = { patron_id: r.patron_id };

	for (const f of SHARED_FIELDS) {
		student[f] = r[`s_${f}`] || '';
		patron[f] = r[`p_${f}`] || '';
	}

	// Build all fields with diff flag
	const fields = [];
	for (const f of SHARED_FIELDS) {
		const sv = (student[f] || '').toString().trim();
		const pv = (patron[f] || '').toString().trim();
		const differs = sv !== pv && (sv || pv);
		fields.push({ field: f, student_val: sv, patron_val: pv, differs: !!differs });
	}

	return { match_type: matchType, student, patron, fields };
}

export const actions = {
	sync: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) {
			throw redirect(303, '/');
		}

		const formData = await request.formData();
		const action = formData.get('sync_action')?.toString();
		const studentId = parseInt(formData.get('student_id')?.toString() || '');
		const patronId = parseInt(formData.get('patron_id')?.toString() || '');
		const skippedParam = formData.get('skipped')?.toString() || '';
		const fieldSelectionsJson = formData.get('field_selections')?.toString() || '{}';

		if (!action) return { success: false, error: 'No action specified.' };

		const qs = skippedParam ? `?skipped=${skippedParam}` : '';

		try {
			if (action === 'apply') {
				if (!studentId || !patronId) return { success: false, error: 'Missing IDs.' };

				/** @type {Record<string, string>} */
				const selections = JSON.parse(fieldSelectionsJson);

				// Build update objects for each table
				/** @type {Record<string, string>} */
				const studentUpdates = {};
				/** @type {Record<string, string>} */
				const patronUpdates = {};

				for (const [field, source] of Object.entries(selections)) {
					if (!SHARED_FIELDS.includes(field)) continue;
					const value = formData.get(`value_${field}`)?.toString() || '';
					if (source === 'student') {
						// Student value wins → update patron
						patronUpdates[field] = value;
					} else if (source === 'patron') {
						// Patron value wins → update student
						studentUpdates[field] = value;
					}
				}

				// Apply student updates
				for (const [field, value] of Object.entries(studentUpdates)) {
					await sql`UPDATE students SET ${sql(field)} = ${value || null}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
				}

				// Apply patron updates
				for (const [field, value] of Object.entries(patronUpdates)) {
					await sql`UPDATE patrons SET ${sql(field)} = ${value || null}, updated_at = CURRENT_TIMESTAMP WHERE patron_id = ${patronId}`;
				}

				const totalUpdates = Object.keys(studentUpdates).length + Object.keys(patronUpdates).length;
				throw redirect(303, `/admin/tools/bi_directional_vbo_sync${qs}`);
			}

			if (action === 'skip' || action === 'not_same_person') {
				const newSkipped = skippedParam ? `${skippedParam},${studentId}-${patronId}` : `${studentId}-${patronId}`;
				throw redirect(303, `/admin/tools/bi_directional_vbo_sync?skipped=${newSkipped}`);
			}

			return { success: false, error: 'Unknown action.' };
		} catch (error) {
			if (/** @type {any} */ (error).status === 303) throw error;
			console.error('Error syncing:', error);
			return { success: false, error: 'Failed: ' + /** @type {Error} */ (error).message };
		}
	}
};
