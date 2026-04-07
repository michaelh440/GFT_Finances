// src/routes/admin/tools/seed_people/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';
import { normalizePhone } from '$lib/phone';

const SHARED_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'mobile_phone', 'address_line1', 'address_line2', 'city', 'state', 'zip_code', 'country'];

export const load = async ({ locals, url }) => {
	if (!locals.user?.is_super_admin) {
		throw redirect(303, '/');
	}

	const activeTable = url.searchParams.get('table') || 'students';
	const skippedParam = url.searchParams.get('skipped') || '';
	const skippedIds = skippedParam ? skippedParam.split(',').map(Number).filter(n => !isNaN(n)) : [];

	try {
		// Stats
		const [counts] = await sql`
			SELECT
				(SELECT COUNT(*) FROM customers) AS customer_count,
				(SELECT COUNT(*) FROM students WHERE customer_id IS NULL) AS students_unlinked,
				(SELECT COUNT(*) FROM students) AS students_total,
				(SELECT COUNT(*) FROM patrons WHERE customer_id IS NULL) AS patrons_unlinked,
				(SELECT COUNT(*) FROM patrons) AS patrons_total,
				(SELECT COUNT(*) FROM corp_contacts WHERE customer_id IS NULL) AS contacts_unlinked,
				(SELECT COUNT(*) FROM corp_contacts) AS contacts_total
		`;

		const stats = {
			customerCount: Number(counts.customer_count),
			studentsUnlinked: Number(counts.students_unlinked),
			studentsTotal: Number(counts.students_total),
			patronsUnlinked: Number(counts.patrons_unlinked),
			patronsTotal: Number(counts.patrons_total),
			contactsUnlinked: Number(counts.contacts_unlinked),
			contactsTotal: Number(counts.contacts_total),
		};

		// Fetch ONE unlinked record from the active table
		let currentRecord = null;
		/** @type {any[]} */
		let candidateMatches = [];

		if (activeTable === 'students') {
			const [record] = await sql`
				SELECT student_id AS record_id, first_name, last_name, email, phone, mobile_phone,
				       vbo_account_id, address_line1, address_line2, city, state, zip_code, country
				FROM students
				WHERE customer_id IS NULL
				  ${skippedIds.length > 0 ? sql`AND student_id != ALL(${skippedIds})` : sql``}
				ORDER BY student_id ASC
				LIMIT 1
			`;
			if (record) {
				currentRecord = { ...record, source_table: 'students', source_id_field: 'student_id' };
			}
		} else if (activeTable === 'patrons') {
			const [record] = await sql`
				SELECT patron_id AS record_id, first_name, last_name, email, phone, mobile_phone,
				       vbo_account_id, address_line1, address_line2, city, state, zip_code, country
				FROM patrons
				WHERE customer_id IS NULL
				  ${skippedIds.length > 0 ? sql`AND patron_id != ALL(${skippedIds})` : sql``}
				ORDER BY patron_id ASC
				LIMIT 1
			`;
			if (record) {
				currentRecord = { ...record, source_table: 'patrons', source_id_field: 'patron_id' };
			}
		} else if (activeTable === 'contacts') {
			const [record] = await sql`
				SELECT corp_contact_id AS record_id, first_name, last_name, email, phone,
				       address_line1, address_line2, city, state, zip AS zip_code, country
				FROM corp_contacts
				WHERE customer_id IS NULL
				  ${skippedIds.length > 0 ? sql`AND corp_contact_id != ALL(${skippedIds})` : sql``}
				ORDER BY corp_contact_id ASC
				LIMIT 1
			`;
			if (record) {
				currentRecord = {
					...record,
					mobile_phone: '',
					vbo_account_id: '',
					source_table: 'corp_contacts',
					source_id_field: 'corp_contact_id'
				};
			}
		}

		// Find candidate matches in customers table
		if (currentRecord) {
			const vbo = (currentRecord.vbo_account_id || '').trim();
			const email = (currentRecord.email || '').trim().toLowerCase();
			const firstName = (currentRecord.first_name || '').trim().toLowerCase();
			const lastName = (currentRecord.last_name || '').trim().toLowerCase();
			// Normalize both phone fields from the incoming record
			const phoneNorms = [
				normalizePhone(currentRecord.phone),
				normalizePhone(currentRecord.mobile_phone)
			].filter(Boolean);

			/** @type {Map<number, any>} */
			const matchMap = new Map();

			// VBO match
			if (vbo && vbo !== '0') {
				const vboMatches = await sql`
					SELECT *, 'vbo' AS match_type FROM customers WHERE ${vbo} = ANY(vbo_account_ids) LIMIT 5
				`;
				for (const m of vboMatches) {
					if (!matchMap.has(m.customer_id)) matchMap.set(m.customer_id, { ...m, match_types: ['vbo'] });
					else matchMap.get(m.customer_id).match_types.push('vbo');
				}
			}

			// Email match — require non-empty email on both sides
			if (email) {
				const emailMatches = await sql`
					SELECT *, 'email' AS match_type FROM customers
					WHERE email IS NOT NULL AND TRIM(email) != ''
					  AND LOWER(TRIM(email)) = ${email}
					LIMIT 5
				`;
				for (const m of emailMatches) {
					if (!matchMap.has(m.customer_id)) matchMap.set(m.customer_id, { ...m, match_types: ['email'] });
					else if (!matchMap.get(m.customer_id).match_types.includes('email')) matchMap.get(m.customer_id).match_types.push('email');
				}
			}

			// Name match — require non-empty names on both sides
			if (firstName && lastName) {
				const nameMatches = await sql`
					SELECT *, 'name' AS match_type FROM customers
					WHERE first_name IS NOT NULL AND TRIM(first_name) != ''
					  AND last_name IS NOT NULL AND TRIM(last_name) != ''
					  AND LOWER(TRIM(first_name)) = ${firstName}
					  AND LOWER(TRIM(last_name)) = ${lastName}
					LIMIT 5
				`;
				for (const m of nameMatches) {
					if (!matchMap.has(m.customer_id)) matchMap.set(m.customer_id, { ...m, match_types: ['name'] });
					else if (!matchMap.get(m.customer_id).match_types.includes('name')) matchMap.get(m.customer_id).match_types.push('name');
				}
			}

			// Phone match — compare normalized digits across phone and mobile_phone
			for (const normPhone of phoneNorms) {
				const phoneMatches = await sql`
					SELECT * FROM customers
					WHERE (
						(LENGTH(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')) >= 7
						 AND RIGHT(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = ${normPhone})
						OR
						(LENGTH(regexp_replace(COALESCE(mobile_phone,''), '[^0-9]', '', 'g')) >= 7
						 AND RIGHT(regexp_replace(COALESCE(mobile_phone,''), '[^0-9]', '', 'g'), 10) = ${normPhone})
					)
					LIMIT 5
				`;
				for (const m of phoneMatches) {
					if (!matchMap.has(m.customer_id)) matchMap.set(m.customer_id, { ...m, match_types: ['phone'] });
					else if (!matchMap.get(m.customer_id).match_types.includes('phone')) matchMap.get(m.customer_id).match_types.push('phone');
				}
			}

			candidateMatches = [...matchMap.values()].map(m => ({
				customer_id: m.customer_id,
				first_name: m.first_name || '',
				last_name: m.last_name || '',
				email: m.email || '',
				phone: m.phone || '',
				mobile_phone: m.mobile_phone || '',
				address_line1: m.address_line1 || '',
				address_line2: m.address_line2 || '',
				city: m.city || '',
				state: m.state || '',
				zip_code: m.zip_code || '',
				country: m.country || '',
				vbo_account_ids: m.vbo_account_ids || [],
				match_types: m.match_types,
			}));
		}

		return {
			stats,
			activeTable,
			currentRecord,
			candidateMatches,
			skippedParam,
		};
	} catch (error) {
		console.error('Error loading seed data:', error);
		return {
			stats: { customerCount: 0, studentsUnlinked: 0, studentsTotal: 0, patronsUnlinked: 0, patronsTotal: 0, contactsUnlinked: 0, contactsTotal: 0 },
			activeTable,
			currentRecord: null,
			candidateMatches: [],
			skippedParam: '',
		};
	}
};

export const actions = {
	create_new: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) throw redirect(303, '/');

		const formData = await request.formData();
		const sourceTable = formData.get('source_table')?.toString();
		const recordId = parseInt(formData.get('record_id')?.toString() || '');
		const activeTable = formData.get('active_table')?.toString() || 'students';
		const skippedParam = formData.get('skipped')?.toString() || '';
		const vboId = (formData.get('vbo_account_id')?.toString() || '').trim();

		// Collect field values from form
		const values = /** @type {Record<string, string|null>} */ ({});
		for (const f of SHARED_FIELDS) {
			values[f] = formData.get(`field_${f}`)?.toString().trim() || null;
		}

		const vboIds = (vboId && vboId !== '0') ? [vboId] : [];

		try {
			const [newCustomer] = await sql`
				INSERT INTO customers (first_name, last_name, email, phone, mobile_phone,
					address_line1, address_line2, city, state, zip_code, country, vbo_account_ids)
				VALUES (${values.first_name}, ${values.last_name}, ${values.email},
					${values.phone}, ${values.mobile_phone},
					${values.address_line1}, ${values.address_line2},
					${values.city}, ${values.state}, ${values.zip_code}, ${values.country},
					${vboIds})
				RETURNING customer_id
			`;

			// Link the source record
			if (sourceTable === 'students') {
				await sql`UPDATE students SET customer_id = ${newCustomer.customer_id} WHERE student_id = ${recordId}`;
			} else if (sourceTable === 'patrons') {
				await sql`UPDATE patrons SET customer_id = ${newCustomer.customer_id} WHERE patron_id = ${recordId}`;
			} else if (sourceTable === 'corp_contacts') {
				await sql`UPDATE corp_contacts SET customer_id = ${newCustomer.customer_id} WHERE corp_contact_id = ${recordId}`;
			}

			const qs = skippedParam ? `?table=${activeTable}&skipped=${skippedParam}` : `?table=${activeTable}`;
			throw redirect(303, `/admin/tools/seed_people${qs}`);
		} catch (error) {
			if (/** @type {any} */ (error).status === 303) throw error;
			console.error('Error creating customer:', error);
			return { success: false, error: 'Failed: ' + /** @type {Error} */ (error).message };
		}
	},

	link_existing: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) throw redirect(303, '/');

		const formData = await request.formData();
		const sourceTable = formData.get('source_table')?.toString();
		const recordId = parseInt(formData.get('record_id')?.toString() || '');
		const customerId = parseInt(formData.get('customer_id')?.toString() || '');
		const activeTable = formData.get('active_table')?.toString() || 'students';
		const skippedParam = formData.get('skipped')?.toString() || '';
		const vboId = (formData.get('vbo_account_id')?.toString() || '').trim();
		const fieldSelectionsJson = formData.get('field_selections')?.toString() || '{}';

		try {
			/** @type {Record<string, string>} */
			const selections = JSON.parse(fieldSelectionsJson);

			// Build update values — only update fields where "incoming" was selected
			const updates = /** @type {Record<string, string|null>} */ ({});
			for (const [field, source] of Object.entries(selections)) {
				if (!SHARED_FIELDS.includes(field)) continue;
				if (source === 'incoming') {
					updates[field] = formData.get(`field_${field}`)?.toString().trim() || null;
				}
			}

			// Apply updates to customer record
			if (Object.keys(updates).length > 0) {
				for (const [field, value] of Object.entries(updates)) {
					await sql`UPDATE customers SET ${sql(field)} = ${value}, updated_at = CURRENT_TIMESTAMP WHERE customer_id = ${customerId}`;
				}
			}

			// Merge VBO ID
			if (vboId && vboId !== '0') {
				await sql`
					UPDATE customers SET
						vbo_account_ids = CASE
							WHEN ${vboId} = ANY(vbo_account_ids) THEN vbo_account_ids
							ELSE array_append(vbo_account_ids, ${vboId})
						END,
						updated_at = CURRENT_TIMESTAMP
					WHERE customer_id = ${customerId}
				`;
			}

			// Link the source record
			if (sourceTable === 'students') {
				await sql`UPDATE students SET customer_id = ${customerId} WHERE student_id = ${recordId}`;
			} else if (sourceTable === 'patrons') {
				await sql`UPDATE patrons SET customer_id = ${customerId} WHERE patron_id = ${recordId}`;
			} else if (sourceTable === 'corp_contacts') {
				await sql`UPDATE corp_contacts SET customer_id = ${customerId} WHERE corp_contact_id = ${recordId}`;
			}

			const qs = skippedParam ? `?table=${activeTable}&skipped=${skippedParam}` : `?table=${activeTable}`;
			throw redirect(303, `/admin/tools/seed_people${qs}`);
		} catch (error) {
			if (/** @type {any} */ (error).status === 303) throw error;
			console.error('Error linking customer:', error);
			return { success: false, error: 'Failed: ' + /** @type {Error} */ (error).message };
		}
	},

	skip: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) throw redirect(303, '/');

		const formData = await request.formData();
		const recordId = formData.get('record_id')?.toString() || '';
		const activeTable = formData.get('active_table')?.toString() || 'students';
		const skippedParam = formData.get('skipped')?.toString() || '';

		const newSkipped = skippedParam ? `${skippedParam},${recordId}` : recordId;
		throw redirect(303, `/admin/tools/seed_people?table=${activeTable}&skipped=${newSkipped}`);
	},

	expedite: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) throw redirect(303, '/');

		const formData = await request.formData();
		const activeTable = formData.get('active_table')?.toString() || 'students';
		const skippedParam = formData.get('skipped')?.toString() || '';

		const skippedIds = skippedParam ? skippedParam.split(',').map(Number).filter(n => !isNaN(n)) : [];

		try {
			let created = 0;

			// Fetch all unlinked records from the active table, excluding skipped
			let unlinked;
			const tableLabel = activeTable === 'patrons' ? 'patrons' : 'students';

			if (activeTable === 'patrons') {
				unlinked = await sql`
					SELECT patron_id AS record_id, first_name, last_name, email, phone, mobile_phone,
					       vbo_account_id, address_line1, address_line2, city, state, zip_code, country
					FROM patrons
					WHERE customer_id IS NULL
					  ${skippedIds.length > 0 ? sql`AND patron_id != ALL(${skippedIds})` : sql``}
					ORDER BY patron_id ASC
				`;
			} else {
				unlinked = await sql`
					SELECT student_id AS record_id, first_name, last_name, email, phone, mobile_phone,
					       vbo_account_id, address_line1, address_line2, city, state, zip_code, country
					FROM students
					WHERE customer_id IS NULL
					  ${skippedIds.length > 0 ? sql`AND student_id != ALL(${skippedIds})` : sql``}
					ORDER BY student_id ASC
				`;
			}

			for (const r of unlinked) {
				const vbo = (r.vbo_account_id || '').trim();
				const email = (r.email || '').trim().toLowerCase();
				const firstName = (r.first_name || '').trim().toLowerCase();
				const lastName = (r.last_name || '').trim().toLowerCase();
				const phoneNorms = [normalizePhone(r.phone), normalizePhone(r.mobile_phone)].filter(Boolean);

				// Check for any match in customers
				let hasMatch = false;

				if (vbo && vbo !== '0') {
					const [m] = await sql`SELECT 1 FROM customers WHERE ${vbo} = ANY(vbo_account_ids) LIMIT 1`;
					if (m) hasMatch = true;
				}

				if (!hasMatch && email) {
					const [m] = await sql`
						SELECT 1 FROM customers
						WHERE email IS NOT NULL AND TRIM(email) != ''
						  AND LOWER(TRIM(email)) = ${email}
						LIMIT 1
					`;
					if (m) hasMatch = true;
				}

				if (!hasMatch && firstName && lastName) {
					const [m] = await sql`
						SELECT 1 FROM customers
						WHERE first_name IS NOT NULL AND TRIM(first_name) != ''
						  AND last_name IS NOT NULL AND TRIM(last_name) != ''
						  AND LOWER(TRIM(first_name)) = ${firstName}
						  AND LOWER(TRIM(last_name)) = ${lastName}
						LIMIT 1
					`;
					if (m) hasMatch = true;
				}

				if (!hasMatch) {
					for (const normPhone of phoneNorms) {
						const [m] = await sql`
							SELECT 1 FROM customers
							WHERE RIGHT(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = ${normPhone}
							   OR RIGHT(regexp_replace(COALESCE(mobile_phone,''), '[^0-9]', '', 'g'), 10) = ${normPhone}
							LIMIT 1
						`;
						if (m) { hasMatch = true; break; }
					}
				}

				if (hasMatch) {
					return {
						success: true,
						message: `Auto-created ${created} customer${created !== 1 ? 's' : ''}. Stopped at "${r.first_name} ${r.last_name}" — match found, needs review.`
					};
				}

				// No match — auto-create customer
				const vboIds = (vbo && vbo !== '0') ? [vbo] : [];

				const [newCustomer] = await sql`
					INSERT INTO customers (first_name, last_name, email, phone, mobile_phone,
						address_line1, address_line2, city, state, zip_code, country, vbo_account_ids)
					VALUES (${r.first_name || null}, ${r.last_name || null}, ${r.email || null},
						${r.phone || null}, ${r.mobile_phone || null},
						${r.address_line1 || null}, ${r.address_line2 || null},
						${r.city || null}, ${r.state || null}, ${r.zip_code || null}, ${r.country || null},
						${vboIds})
					RETURNING customer_id
				`;

				if (activeTable === 'patrons') {
					await sql`UPDATE patrons SET customer_id = ${newCustomer.customer_id} WHERE patron_id = ${r.record_id}`;
				} else {
					await sql`UPDATE students SET customer_id = ${newCustomer.customer_id} WHERE student_id = ${r.record_id}`;
				}
				created++;
			}

			return {
				success: true,
				message: `Auto-created ${created} customer${created !== 1 ? 's' : ''}. All ${tableLabel} processed.`
			};
		} catch (error) {
			console.error('Error in expedite:', error);
			return { success: false, error: 'Failed: ' + /** @type {Error} */ (error).message };
		}
	},

	expedite_all: async ({ request, locals }) => {
		if (!locals.user?.is_super_admin) throw redirect(303, '/');

		const formData = await request.formData();
		const activeTable = formData.get('active_table')?.toString() || 'patrons';

		try {
			let created = 0;
			let skippedMatches = 0;

			const unlinked = await sql`
				SELECT patron_id AS record_id, first_name, last_name, email, phone, mobile_phone,
				       vbo_account_id, address_line1, address_line2, city, state, zip_code, country
				FROM patrons
				WHERE customer_id IS NULL
				ORDER BY patron_id ASC
			`;

			for (const r of unlinked) {
				const vbo = (r.vbo_account_id || '').trim();
				const email = (r.email || '').trim().toLowerCase();
				const firstName = (r.first_name || '').trim().toLowerCase();
				const lastName = (r.last_name || '').trim().toLowerCase();
				const phoneNorms = [normalizePhone(r.phone), normalizePhone(r.mobile_phone)].filter(Boolean);

				let hasMatch = false;

				if (vbo && vbo !== '0') {
					const [m] = await sql`SELECT 1 FROM customers WHERE ${vbo} = ANY(vbo_account_ids) LIMIT 1`;
					if (m) hasMatch = true;
				}

				if (!hasMatch && email) {
					const [m] = await sql`
						SELECT 1 FROM customers
						WHERE email IS NOT NULL AND TRIM(email) != ''
						  AND LOWER(TRIM(email)) = ${email}
						LIMIT 1
					`;
					if (m) hasMatch = true;
				}

				if (!hasMatch && firstName && lastName) {
					const [m] = await sql`
						SELECT 1 FROM customers
						WHERE first_name IS NOT NULL AND TRIM(first_name) != ''
						  AND last_name IS NOT NULL AND TRIM(last_name) != ''
						  AND LOWER(TRIM(first_name)) = ${firstName}
						  AND LOWER(TRIM(last_name)) = ${lastName}
						LIMIT 1
					`;
					if (m) hasMatch = true;
				}

				if (!hasMatch) {
					for (const normPhone of phoneNorms) {
						const [m] = await sql`
							SELECT 1 FROM customers
							WHERE (LENGTH(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')) >= 7
							       AND RIGHT(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = ${normPhone})
							   OR (LENGTH(regexp_replace(COALESCE(mobile_phone,''), '[^0-9]', '', 'g')) >= 7
							       AND RIGHT(regexp_replace(COALESCE(mobile_phone,''), '[^0-9]', '', 'g'), 10) = ${normPhone})
							LIMIT 1
						`;
						if (m) { hasMatch = true; break; }
					}
				}

				if (hasMatch) {
					skippedMatches++;
					continue;
				}

				// No match — auto-create customer
				const vboIds = (vbo && vbo !== '0') ? [vbo] : [];

				const [newCustomer] = await sql`
					INSERT INTO customers (first_name, last_name, email, phone, mobile_phone,
						address_line1, address_line2, city, state, zip_code, country, vbo_account_ids)
					VALUES (${r.first_name || null}, ${r.last_name || null}, ${r.email || null},
						${r.phone || null}, ${r.mobile_phone || null},
						${r.address_line1 || null}, ${r.address_line2 || null},
						${r.city || null}, ${r.state || null}, ${r.zip_code || null}, ${r.country || null},
						${vboIds})
					RETURNING customer_id
				`;

				await sql`UPDATE patrons SET customer_id = ${newCustomer.customer_id} WHERE patron_id = ${r.record_id}`;
				created++;
			}

			return {
				success: true,
				message: `Auto-created ${created} customer${created !== 1 ? 's' : ''}, skipped ${skippedMatches} with existing matches. Review remaining matches manually.`
			};
		} catch (error) {
			console.error('Error in expedite_all:', error);
			return { success: false, error: 'Failed: ' + /** @type {Error} */ (error).message };
		}
	},

	expedite_name: async ({ locals }) => {
		if (!locals.user?.is_super_admin) throw redirect(303, '/');

		try {
			let linked = 0;
			let skipped = 0;

			const unlinked = await sql`
				SELECT patron_id, first_name, last_name, email, phone, mobile_phone,
				       vbo_account_id, address_line1, address_line2, city, state, zip_code, country
				FROM patrons
				WHERE customer_id IS NULL
				ORDER BY patron_id ASC
			`;

			for (const p of unlinked) {
				const firstName = (p.first_name || '').trim();
				const lastName = (p.last_name || '').trim();

				if (!firstName || !lastName) { skipped++; continue; }

				// Check which patron fields have data (beyond first/last name)
				const patronEmail = (p.email || '').trim();
				const patronPhone = (p.phone || '').trim();
				const patronMobile = (p.mobile_phone || '').trim();
				const patronAddr = (p.address_line1 || '').trim();
				const patronCity = (p.city || '').trim();
				const patronState = (p.state || '').trim();
				const patronZip = (p.zip_code || '').trim();
				const patronCountry = (p.country || '').trim();
				const patronVbo = (p.vbo_account_id || '').trim();

				// Only proceed if patron has ONLY name, or name + country
				const hasExtraFields = patronEmail || patronPhone || patronMobile || patronAddr || patronCity || patronState || patronZip || (patronVbo && patronVbo !== '0');
				if (hasExtraFields) { skipped++; continue; }

				// Patron has only: first_name, last_name, and optionally country
				// Find an exact name match in customers
				const nameMatches = await sql`
					SELECT customer_id, first_name, last_name, email, phone, mobile_phone,
					       address_line1, city, state, zip_code, country
					FROM customers
					WHERE LOWER(TRIM(first_name)) = ${firstName.toLowerCase()}
					  AND LOWER(TRIM(last_name)) = ${lastName.toLowerCase()}
					  AND first_name IS NOT NULL AND TRIM(first_name) != ''
					  AND last_name IS NOT NULL AND TRIM(last_name) != ''
				`;

				// Must be exactly one match
				if (nameMatches.length !== 1) { skipped++; continue; }

				const cust = nameMatches[0];

				// If patron has country, customer's country must match exactly
				if (patronCountry) {
					const custCountry = (cust.country || '').trim();
					if (patronCountry.toLowerCase() !== custCountry.toLowerCase()) { skipped++; continue; }
				}

				// All checks passed — link patron to this customer
				await sql`UPDATE patrons SET customer_id = ${cust.customer_id} WHERE patron_id = ${p.patron_id}`;
				linked++;
			}

			return {
				success: true,
				message: `Linked ${linked} patron${linked !== 1 ? 's' : ''} by exact name match, skipped ${skipped}.`
			};
		} catch (error) {
			console.error('Error in expedite_name:', error);
			return { success: false, error: 'Failed: ' + /** @type {Error} */ (error).message };
		}
	},
};
