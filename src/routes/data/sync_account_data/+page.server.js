// src/routes/shows/patrons/sync_acct_id/+page.server.js
import sql from '$lib/db';

const norm = (/** @type {string} */ s) => (s || '').trim().toLowerCase();

export const load = async () => {
	try {
		const patronCount = await sql`SELECT COUNT(*) AS count FROM patrons`;
		const withAcctId = await sql`SELECT COUNT(*) AS count FROM patrons WHERE vbo_account_id IS NOT NULL AND TRIM(vbo_account_id) != ''`;
		const withoutAcctId = await sql`SELECT COUNT(*) AS count FROM patrons WHERE vbo_account_id IS NULL OR TRIM(vbo_account_id) = ''`;
		const studentsWithAcctId = await sql`SELECT COUNT(*) AS count FROM students WHERE vbo_account_id IS NOT NULL AND TRIM(vbo_account_id) != ''`;

		return {
			stats: {
				totalPatrons: Number(patronCount[0].count),
				withAcctId: Number(withAcctId[0].count),
				withoutAcctId: Number(withoutAcctId[0].count),
				studentsWithAcctId: Number(studentsWithAcctId[0].count)
			}
		};
	} catch (error) {
		console.error('Error loading stats:', error);
		return { stats: { totalPatrons: 0, withAcctId: 0, withoutAcctId: 0, studentsWithAcctId: 0 } };
	}
};

export const actions = {
	find_matches: async () => {
		try {
			// Get all students that have a vbo_account_id
			const students = await sql`
				SELECT student_id, first_name, last_name, email, phone, mobile_phone, vbo_account_id
				FROM students
				WHERE vbo_account_id IS NOT NULL AND TRIM(vbo_account_id) != ''
			`;

			// Get all patrons
			const patrons = await sql`
				SELECT patron_id, first_name, last_name, email, phone, mobile_phone, vbo_account_id
				FROM patrons
			`;

			// Build lookup maps for patrons
			/** @type {Record<string, any[]>} */
			const patronsByEmail = {};
			/** @type {Record<string, any[]>} */
			const patronsByName = {};
			for (const p of patrons) {
				const email = norm(p.email);
				if (email) {
					if (!patronsByEmail[email]) patronsByEmail[email] = [];
					patronsByEmail[email].push(p);
				}
				const nameKey = `${norm(p.first_name)}|${norm(p.last_name)}`;
				if (!patronsByName[nameKey]) patronsByName[nameKey] = [];
				patronsByName[nameKey].push(p);
			}

			// Match each student to patron(s)
			const matchResults = [];

			for (const student of students) {
				let matchedPatron = null;
				let matchType = 'no_match';

				// 1. Email match
				const email = norm(student.email);
				if (email && patronsByEmail[email]) {
					matchedPatron = patronsByEmail[email][0];
					matchType = 'email_match';
				}

				// 2. Name match fallback
				if (!matchedPatron) {
					const nameKey = `${norm(student.first_name)}|${norm(student.last_name)}`;
					if (patronsByName[nameKey]) {
						matchedPatron = patronsByName[nameKey][0];
						matchType = 'name_match';
					}
				}

				if (!matchedPatron) {
					matchResults.push({
						student: {
							student_id: student.student_id,
							first_name: student.first_name,
							last_name: student.last_name,
							email: student.email,
							vbo_account_id: student.vbo_account_id
						},
						patron: null,
						matchType: 'no_match',
						needsUpdate: false,
						alreadyMatches: false
					});
					continue;
				}

				const patronAcctId = (matchedPatron.vbo_account_id || '').trim();
				const studentAcctId = (student.vbo_account_id || '').trim();
				const alreadyMatches = patronAcctId === studentAcctId;
				const needsUpdate = !alreadyMatches && studentAcctId !== '';

				matchResults.push({
					student: {
						student_id: student.student_id,
						first_name: student.first_name,
						last_name: student.last_name,
						email: student.email,
						vbo_account_id: student.vbo_account_id
					},
					patron: {
						patron_id: matchedPatron.patron_id,
						first_name: matchedPatron.first_name,
						last_name: matchedPatron.last_name,
						email: matchedPatron.email,
						acct_id: matchedPatron.vbo_account_id
					},
					matchType,
					needsUpdate,
					alreadyMatches
				});
			}

			// Sort: needs update first, then already set, then no match
			matchResults.sort((a, b) => {
				if (a.needsUpdate && !b.needsUpdate) return -1;
				if (!a.needsUpdate && b.needsUpdate) return 1;
				if (a.matchType === 'no_match' && b.matchType !== 'no_match') return 1;
				if (a.matchType !== 'no_match' && b.matchType === 'no_match') return -1;
				return 0;
			});

			const summary = {
				total: matchResults.length,
				matched: matchResults.filter((r) => r.matchType !== 'no_match').length,
				unmatched: matchResults.filter((r) => r.matchType === 'no_match').length,
				needsUpdate: matchResults.filter((r) => r.needsUpdate).length,
				alreadySet: matchResults.filter((r) => r.alreadyMatches).length,
				patronHasDifferent: matchResults.filter((r) => r.patron && r.patron.acct_id && !r.alreadyMatches && r.needsUpdate).length
			};

			console.log(`[sync_acct_id] Found ${summary.total} students with AcctID, ${summary.matched} matched to patrons, ${summary.needsUpdate} need update`);

			return {
				success: true,
				action: 'find_matches',
				matchResults,
				summary
			};
		} catch (error) {
			console.error('Error finding matches:', error);
			return { success: false, error: 'Failed to find matches. ' + /** @type {Error} */ (error).message };
		}
	},

	apply_updates: async ({ request }) => {
		const formData = await request.formData();
		const updatesJson = formData.get('updates_json')?.toString() || '[]';

		let updates;
		try {
			updates = JSON.parse(updatesJson);
		} catch {
			return { success: false, error: 'Invalid update data.' };
		}

		if (!Array.isArray(updates) || updates.length === 0) {
			return { success: false, error: 'No updates to apply.' };
		}

		let updated = 0;
		const errors = [];

		for (const { patron_id, vbo_account_id } of updates) {
			if (!patron_id || !vbo_account_id) continue;
			try {
				await sql`
					UPDATE patrons
					SET vbo_account_id = ${vbo_account_id}, updated_at = CURRENT_TIMESTAMP
					WHERE patron_id = ${patron_id}
				`;
				updated++;
			} catch (error) {
				console.error(`Error updating patron ${patron_id}:`, error);
				errors.push(`Patron ${patron_id}: ${/** @type {Error} */ (error).message}`);
			}
		}

		console.log(`[sync_acct_id] Updated ${updated} patrons${errors.length > 0 ? `, ${errors.length} errors` : ''}`);

		return {
			success: true,
			action: 'apply_updates',
			message: `Updated ${updated} patron${updated !== 1 ? 's' : ''}${errors.length > 0 ? `. ${errors.length} error(s).` : '.'}`,
			errors
		};
	}
};