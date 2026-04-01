// src/routes/shows/patrons/update_patrons/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'gft', 'manager');
	try {
		const [stats] = await sql`
			SELECT
				COUNT(*)::int AS total_patrons,
				COUNT(*) FILTER (WHERE zip_code IS NOT NULL AND zip_code != '')::int AS with_zip,
				COUNT(*) FILTER (WHERE city IS NOT NULL AND city != '')::int AS with_city
			FROM patrons
		`;
		return { stats };
	} catch (error) {
		console.error('Error loading patron stats:', error);
		return { stats: { total_patrons: 0, with_zip: 0, with_city: 0 } };
	}
};

export const actions = {
	// Step 1: Parse CSV and return preview of matches
	csv_upload: async ({ request, locals }) => {
		requirePermission(locals.user, 'gft', 'manager');
		const formData = await request.formData();
		const file = formData.get('csv_file');

		if (!file || typeof file === 'string') {
			return { success: false, error: 'Please select a CSV file.' };
		}

		try {
			const text = await file.text();
			console.log('[update_patrons] CSV file size:', text.length, 'chars');
			console.log('[update_patrons] First 500 chars:', text.substring(0, 500));

			const parsed = parseUpdatedCSZ(text);
			console.log('[update_patrons] Parsed rows:', parsed.length);
			if (parsed.length > 0) {
				console.log('[update_patrons] First parsed row:', JSON.stringify(parsed[0]));
				console.log('[update_patrons] Sample with address:', JSON.stringify(parsed.find(r => r.zip_code) || 'none with zip'));
			}

			if (parsed.length === 0) {
				return { success: false, error: 'No valid data rows found in the CSV.' };
			}

			// Deduplicate by first+last+email — keep first occurrence with most data
			const uniqueMap = new Map();
			for (const row of parsed) {
				const key = `${(row.firstName || '').toLowerCase()}|${(row.lastName || '').toLowerCase()}|${(row.email || '').toLowerCase()}`;
				if (!key || key === '||') continue;
				if (!uniqueMap.has(key) || (row.zip_code && !uniqueMap.get(key).zip_code)) {
					uniqueMap.set(key, row);
				}
			}
			const uniqueRows = [...uniqueMap.values()];
			console.log('[update_patrons] Unique rows after dedup:', uniqueRows.length);

			// Match against existing patrons
			const patrons = await sql`
				SELECT patron_id, first_name, last_name, email, phone,
					address_line1, address_line2, city, state, zip_code, country
				FROM patrons
			`;
			console.log('[update_patrons] Patrons in database:', patrons.length);

			const matched = [];
			const unmatched = [];
			let matchByNameEmail = 0;
			let matchByNameOnly = 0;
			let matchByEmail = 0;
			let matchByNamePhone = 0;

			// Helper: normalize for comparison
			/** @param {string} s */
			const norm = (s) => (s || '').toLowerCase().trim();

			for (const row of uniqueRows) {
				// Skip rows with no name
				if (!row.firstName && !row.lastName) continue;

				const rowFirst = norm(row.firstName);
				const rowLast = norm(row.lastName);
				const rowEmail = norm(row.email);
				const rowPhone = norm(row.phone);

				let patron = null;
				let matchMethod = '';

				// 1. First + Last + Email (highest confidence)
				if (rowEmail) {
					patron = patrons.find(
						(p) =>
							norm(p.first_name) === rowFirst &&
							norm(p.last_name) === rowLast &&
							norm(p.email) === rowEmail
					);
					if (patron) matchMethod = 'name+email';
				}

				// 2. First + Last name only
				if (!patron) {
					patron = patrons.find(
						(p) =>
							norm(p.first_name) === rowFirst &&
							norm(p.last_name) === rowLast
					);
					if (patron) matchMethod = 'name';
				}

				// 3. Email only (catches name changes/typos)
				if (!patron && rowEmail) {
					patron = patrons.find(
						(p) => norm(p.email) === rowEmail && norm(p.email) !== ''
					);
					if (patron) matchMethod = 'email';
				}

				// 4. First + Last + Phone (catches different email but same phone)
				if (!patron && rowPhone) {
					patron = patrons.find(
						(p) =>
							norm(p.first_name) === rowFirst &&
							norm(p.last_name) === rowLast &&
							norm(p.phone) === rowPhone &&
							norm(p.phone) !== ''
					);
					if (patron) matchMethod = 'name+phone';
				}

				// Track match methods
				if (matchMethod === 'name+email') matchByNameEmail++;
				else if (matchMethod === 'name') matchByNameOnly++;
				else if (matchMethod === 'email') matchByEmail++;
				else if (matchMethod === 'name+phone') matchByNamePhone++;

				if (patron) {
					// Only include if there's new address data to add
					const hasNewData =
						(row.address_line1 && !patron.address_line1) ||
						(row.city && !patron.city) ||
						(row.zip_code && !patron.zip_code) ||
						(row.state && !patron.state) ||
						(row.phone && !patron.phone);

					matched.push({
						patron_id: patron.patron_id,
						name: `${patron.first_name} ${patron.last_name}`,
						email: patron.email || '',
						matchMethod,
						current: {
							address_line1: patron.address_line1 || '',
							address_line2: patron.address_line2 || '',
							city: patron.city || '',
							state: patron.state || '',
							zip_code: patron.zip_code || '',
							country: patron.country || '',
							phone: patron.phone || ''
						},
						update: {
							address_line1: row.address_line1 || '',
							address_line2: row.address_line2 || '',
							city: row.city || '',
							state: row.state || '',
							zip_code: row.zip_code || '',
							country: row.country || '',
							phone: row.phone || ''
						},
						hasNewData
					});
				} else {
					unmatched.push({
						name: `${row.firstName} ${row.lastName}`,
						email: row.email || '',
						phone: row.phone || '',
						zip_code: row.zip_code || '',
						city: row.city || ''
					});
				}
			}

			console.log('[update_patrons] --- MATCHING SUMMARY ---');
			console.log('[update_patrons] Matched by name+email:', matchByNameEmail);
			console.log('[update_patrons] Matched by name only:', matchByNameOnly);
			console.log('[update_patrons] Matched by email only:', matchByEmail);
			console.log('[update_patrons] Matched by name+phone:', matchByNamePhone);
			console.log('[update_patrons] Total matched:', matched.length);
			console.log('[update_patrons] With new data:', matched.filter((m) => m.hasNewData).length);
			console.log('[update_patrons] Unmatched:', unmatched.length);
			if (unmatched.length > 0) {
				console.log('[update_patrons] ALL unmatched:');
				for (const u of unmatched) {
					console.log(`  - "${u.name}" email="${u.email}" phone="${u.phone}"`);
				}
			}
			if (matched.length > 0) {
				console.log('[update_patrons] First matched example:', JSON.stringify(matched[0]));
			}

			return {
				success: true,
				action: 'csv_upload',
				matched,
				unmatched,
				totalParsed: uniqueRows.length,
				matchedCount: matched.length,
				withNewData: matched.filter((m) => m.hasNewData).length,
				unmatchedCount: unmatched.length
			};
		} catch (error) {
			console.error('Error parsing CSV:', error);
			return { success: false, error: 'Failed to parse CSV: ' + (error instanceof Error ? error.message : String(error)) };
		}
	},

	// Step 2: Apply updates
	apply_updates: async ({ request, locals }) => {
		requirePermission(locals.user, 'gft', 'manager');
		const formData = await request.formData();
		const matchedJson = formData.get('matched_json')?.toString();
		const mode = formData.get('update_mode') || 'fill'; // 'fill' or 'overwrite'

		if (!matchedJson) {
			return { success: false, error: 'No update data provided.' };
		}

		let matched;
		try {
			matched = JSON.parse(matchedJson);
		} catch {
			return { success: false, error: 'Invalid data.' };
		}

		let updated = 0;
		let skipped = 0;

		try {
			for (const m of matched) {
				if (!m.hasNewData && mode === 'fill') {
					skipped++;
					continue;
				}

				// Build SET clause based on mode
				if (mode === 'fill') {
					// Only fill empty fields
					await sql`
						UPDATE patrons SET
							address_line1 = CASE WHEN (address_line1 IS NULL OR address_line1 = '') AND ${m.update.address_line1} != '' THEN ${m.update.address_line1} ELSE address_line1 END,
							address_line2 = CASE WHEN (address_line2 IS NULL OR address_line2 = '') AND ${m.update.address_line2} != '' THEN ${m.update.address_line2} ELSE address_line2 END,
							city = CASE WHEN (city IS NULL OR city = '') AND ${m.update.city} != '' THEN ${m.update.city} ELSE city END,
							state = CASE WHEN (state IS NULL OR state = '') AND ${m.update.state} != '' THEN ${m.update.state} ELSE state END,
							zip_code = CASE WHEN (zip_code IS NULL OR zip_code = '') AND ${m.update.zip_code} != '' THEN ${m.update.zip_code} ELSE zip_code END,
							country = CASE WHEN (country IS NULL OR country = '') AND ${m.update.country} != '' THEN ${m.update.country} ELSE country END,
							phone = CASE WHEN (phone IS NULL OR phone = '') AND ${m.update.phone} != '' THEN ${m.update.phone} ELSE phone END,
							updated_at = CURRENT_TIMESTAMP
						WHERE patron_id = ${m.patron_id}
					`;
				} else {
					// Overwrite all non-empty values
					await sql`
						UPDATE patrons SET
							address_line1 = CASE WHEN ${m.update.address_line1} != '' THEN ${m.update.address_line1} ELSE address_line1 END,
							address_line2 = CASE WHEN ${m.update.address_line2} != '' THEN ${m.update.address_line2} ELSE address_line2 END,
							city = CASE WHEN ${m.update.city} != '' THEN ${m.update.city} ELSE city END,
							state = CASE WHEN ${m.update.state} != '' THEN ${m.update.state} ELSE state END,
							zip_code = CASE WHEN ${m.update.zip_code} != '' THEN ${m.update.zip_code} ELSE zip_code END,
							country = CASE WHEN ${m.update.country} != '' THEN ${m.update.country} ELSE country END,
							phone = CASE WHEN ${m.update.phone} != '' THEN ${m.update.phone} ELSE phone END,
							updated_at = CURRENT_TIMESTAMP
						WHERE patron_id = ${m.patron_id}
					`;
				}
				updated++;
			}

			return {
				success: true,
				action: 'apply_updates',
				updated,
				skipped
			};
		} catch (error) {
			console.error('Error applying updates:', error);
			return { success: false, error: 'Update failed: ' + (error instanceof Error ? error.message : String(error)) };
		}
	}
};

/**
 * Parse the updated CSZ report CSV with address columns
 * Columns: Rec, First Name, Last Name, Address, Address 2, City, State/Province, ZipCode, Country, Email, Phone, Event Name, ...
 */
/** @param {string} text */
function parseUpdatedCSZ(text) {
	const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const rows = [];
	let totalLines = lines.length;
	let dataLineCount = 0;
	let skippedShortFields = 0;
	let skippedAnonymous = 0;

	console.log('[parseUpdatedCSZ] Total lines in file:', totalLines);

	for (const line of lines) {
		if (!line.match(/^"[0-9]+\./)) continue;
		dataLineCount++;

		const fields = parseCSVLine(line);

		// Log first few data rows for debugging
		if (dataLineCount <= 3) {
			console.log(`[parseUpdatedCSZ] Row ${dataLineCount}: ${fields.length} fields`);
			console.log(`[parseUpdatedCSZ] Fields:`, fields.slice(0, 12));
		}

		if (fields.length < 21) {
			skippedShortFields++;
			if (skippedShortFields <= 3) {
				console.log(`[parseUpdatedCSZ] Row ${dataLineCount} skipped: only ${fields.length} fields (need 21). Maybe old format?`);
			}
			continue;
		}

		const firstName = fields[1] || '';
		const lastName = fields[2] || '';
		const address_line1 = fields[3] || '';
		const address_line2 = fields[4] || '';
		const city = fields[5] || '';
		const state = fields[6] || '';
		const zip_code = fields[7] || '';
		const country = fields[8] || '';
		const email = fields[9] || '';
		const phone = (fields[10] || '').trim();

		// Skip anonymous rows
		if (!firstName && !lastName) {
			skippedAnonymous++;
			continue;
		}

		rows.push({
			firstName,
			lastName,
			email,
			phone: phone && phone !== ' ' ? phone : '',
			address_line1,
			address_line2,
			city,
			state,
			zip_code,
			country
		});
	}

	console.log('[parseUpdatedCSZ] --- PARSE SUMMARY ---');
	console.log('[parseUpdatedCSZ] Data lines found (matching "N."):', dataLineCount);
	console.log('[parseUpdatedCSZ] Skipped (too few fields):', skippedShortFields);
	console.log('[parseUpdatedCSZ] Skipped (anonymous):', skippedAnonymous);
	console.log('[parseUpdatedCSZ] Valid rows returned:', rows.length);
	console.log('[parseUpdatedCSZ] Rows with zip:', rows.filter(r => r.zip_code).length);

	return rows;
}

/** @param {string} line */
function parseCSVLine(line) {
	const result = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
		} else if (ch === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += ch;
		}
	}
	result.push(current.trim());
	return result;
}