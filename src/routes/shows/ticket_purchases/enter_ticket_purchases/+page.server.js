// src/routes/shows/ticket_purchases/enter_ticket_purchases/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const shows = await sql`
			SELECT show_code, show_name, format, standard_ticket_price
			FROM shows
			WHERE is_active = true
			ORDER BY format ASC, show_name ASC
		`;

		const patrons = await sql`
			SELECT patron_id, first_name, last_name, email, phone
			FROM patrons
			WHERE is_active = true
			ORDER BY last_name ASC, first_name ASC
		`;

		const promotions = await sql`
			SELECT promotion_id, promotion_name, discount_type, discount_value, start_date, end_date, is_active
			FROM promotions
			ORDER BY promotion_name ASC
		`;

		return {
			shows: shows.map((s) => ({
				...s,
				standard_ticket_price: Number(s.standard_ticket_price || 0)
			})),
			patrons,
			promotions
		};
	} catch (error) {
		console.error('Error loading form data:', error);
		return { shows: [], patrons: [], promotions: [] };
	}
};

// ============================================================
// CSV PARSING — auto-detects old (16 field) vs new (22 field) format
// ============================================================

function parseCSZReport(text) {
	const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const rows = [];
	const eventNamesSet = new Set();
	const discountCodesSet = new Set();
	let detectedFormat = null;

	for (const line of lines) {
		if (!line.match(/^"[0-9]+\./)) continue;

		const fields = parseCSVLine(line);

		// Auto-detect format on first data row
		// v2 = 23 fields (has AcctID + address)
		// new = 22 fields (address, no AcctID)
		// old = 16 fields (no address, no AcctID)
		if (detectedFormat === null) {
			if (fields.length >= 23) {
				detectedFormat = 'v2';
				console.log('[csv_parse] Detected V2 format (23 fields, with AcctID + address)');
			} else if (fields.length >= 21) {
				detectedFormat = 'new';
				console.log('[csv_parse] Detected NEW format (22 fields, with address, no AcctID)');
			} else if (fields.length >= 15) {
				detectedFormat = 'old';
				console.log('[csv_parse] Detected OLD format (16 fields, no address)');
			} else {
				console.log('[csv_parse] Unknown format, fields:', fields.length);
				continue;
			}
		}

		let row;
		if (detectedFormat === 'v2') {
			// 0:Rec, 1:AcctID, 2:First, 3:Last, 4:Address, 5:Address2, 6:City, 7:State, 8:Zip, 9:Country,
			// 10:Email, 11:Phone, 12:EventName, 13:Venue, 14:EventDate, 15:Qty, 16:DiscountCode,
			// 17:DiscountValue, 18:Orders, 19:DateCreated, 20:DateScanned, 21:ItemTotal
			if (fields.length < 22) continue;
			const acctId = (fields[1] || '').trim();
			row = {
				acctId: acctId && acctId !== '0' ? acctId : '',
				firstName: fields[2] || '',
				lastName: fields[3] || '',
				address_line1: fields[4] || '',
				address_line2: fields[5] || '',
				city: fields[6] || '',
				state: fields[7] || '',
				zip_code: fields[8] || '',
				country: fields[9] || '',
				email: fields[10] || '',
				phone: (fields[11] || '').trim(),
				eventName: fields[12] || '',
				eventDateStr: fields[14] || '',
				qty: parseInt(fields[15]) || 0,
				discountCode: fields[16] || '',
				discountValue: parseFloat(fields[17]) || 0,
				dateCreated: fields[19] || '',
				itemTotal: parseFloat(fields[21]) || 0
			};
		} else if (detectedFormat === 'new') {
			// 0:Rec, 1:First, 2:Last, 3:Address, 4:Address2, 5:City, 6:State, 7:Zip, 8:Country,
			// 9:Email, 10:Phone, 11:EventName, 12:Venue, 13:EventDate, 14:Qty, 15:DiscountCode,
			// 16:DiscountValue, 17:Orders, 18:DateCreated, 19:DateScanned, 20:ItemTotal
			if (fields.length < 21) continue;
			row = {
				acctId: '',
				firstName: fields[1] || '',
				lastName: fields[2] || '',
				address_line1: fields[3] || '',
				address_line2: fields[4] || '',
				city: fields[5] || '',
				state: fields[6] || '',
				zip_code: fields[7] || '',
				country: fields[8] || '',
				email: fields[9] || '',
				phone: (fields[10] || '').trim(),
				eventName: fields[11] || '',
				eventDateStr: fields[13] || '',
				qty: parseInt(fields[14]) || 0,
				discountCode: fields[15] || '',
				discountValue: parseFloat(fields[16]) || 0,
				dateCreated: fields[18] || '',
				itemTotal: parseFloat(fields[20]) || 0
			};
		} else {
			// 0:Rec, 1:First, 2:Last, 3:Email, 4:Phone, 5:EventName, 6:Venue,
			// 7:EventDate, 8:Qty, 9:DiscountCode, 10:DiscountValue, 11:Orders,
			// 12:DateCreated, 13:DateScanned, 14:ItemTotal
			if (fields.length < 15) continue;
			row = {
				acctId: '',
				firstName: fields[1] || '',
				lastName: fields[2] || '',
				email: fields[3] || '',
				phone: fields[4] || '',
				eventName: fields[5] || '',
				eventDateStr: fields[7] || '',
				qty: parseInt(fields[8]) || 0,
				discountCode: fields[9] || '',
				discountValue: parseFloat(fields[10]) || 0,
				dateCreated: fields[12] || '',
				itemTotal: parseFloat(fields[14]) || 0,
				address_line1: '',
				address_line2: '',
				city: '',
				state: '',
				zip_code: '',
				country: ''
			};
		}

		// Clean phone
		if (row.phone === ' ' || row.phone === '') row.phone = '';

		if (!row.eventName) continue;

		// Parse dates
		row.showDate = parseDate(row.eventDateStr);
		row.purchaseDate = parseDate(row.dateCreated);

		eventNamesSet.add(row.eventName);
		if (row.discountCode) discountCodesSet.add(row.discountCode);

		rows.push(row);
	}

	const hasAcctIds = rows.some((r) => r.acctId);
	console.log(`[csv_parse] Parsed ${rows.length} data rows, ${eventNamesSet.size} unique events, format=${detectedFormat}, hasAcctIds=${hasAcctIds}`);

	return {
		rows,
		eventNames: [...eventNamesSet].sort(),
		discountCodes: [...discountCodesSet].sort(),
		format: detectedFormat,
		hasAcctIds
	};
}

function parseDate(str) {
	if (!str) return null;
	const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (!match) return null;
	return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

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

// ============================================================
// PATRON MATCHING
// ============================================================

const norm = (s) => (s || '').toLowerCase().trim();

/**
 * Find potential patron matches for a CSV row.
 * AcctID match = 100% confidence (definitive).
 * Returns array of { patron, matchType, confidence } sorted by confidence.
 */
function findPatronMatches(row, allPatrons) {
	const matches = [];
	const rowFirst = norm(row.firstName);
	const rowLast = norm(row.lastName);
	const rowEmail = norm(row.email);
	const rowPhone = norm(row.phone);
	const rowAcctId = (row.acctId || '').trim();

	for (const p of allPatrons) {
		const pFirst = norm(p.first_name);
		const pLast = norm(p.last_name);
		const pEmail = norm(p.email);
		const pPhone = norm(p.phone);
		const pAcctId = (p.vbo_account_id || '').trim();

		let matchType = '';
		let confidence = 0;

		// VBO Account ID match (definitive)
		if (rowAcctId && pAcctId && rowAcctId === pAcctId) {
			matchType = 'acctid';
			confidence = 100;
		}
		// Exact name + email
		else if (pFirst === rowFirst && pLast === rowLast && rowEmail && pEmail === rowEmail) {
			matchType = 'name+email';
			confidence = 95;
		}
		// Name + phone
		else if (pFirst === rowFirst && pLast === rowLast && rowPhone && pPhone && pPhone === rowPhone) {
			matchType = 'name+phone';
			confidence = 85;
		}
		// Exact name only
		else if (pFirst === rowFirst && pLast === rowLast) {
			matchType = 'name';
			confidence = 80;
		}
		// Last name + email
		else if (pLast === rowLast && rowEmail && pEmail === rowEmail) {
			matchType = 'lastname+email';
			confidence = 75;
		}
		// Email only
		else if (rowEmail && pEmail && pEmail === rowEmail) {
			matchType = 'email';
			confidence = 70;
		}

		if (matchType) {
			matches.push({
				patron_id: p.patron_id,
				first_name: p.first_name,
				last_name: p.last_name,
				email: p.email || '',
				phone: p.phone || '',
				vbo_account_id: p.vbo_account_id || '',
				matchType,
				confidence
			});
		}
	}

	// Sort by confidence desc
	matches.sort((a, b) => b.confidence - a.confidence);
	return matches;
}

// ============================================================
// ACTIONS
// ============================================================

export const actions = {
	// Manual row entry (unchanged)
	manual: async ({ request }) => {
		const formData = await request.formData();
		const rowCount = parseInt(formData.get('row_count')) || 0;

		if (rowCount === 0) {
			return { success: false, error: 'No data to save.' };
		}

		let saved = 0;
		let skipped = 0;
		let newPatrons = 0;
		const results = [];

		try {
			for (let i = 0; i < rowCount; i++) {
				const mode = formData.get(`mode_${i}`) || 'existing';
				const showCode = formData.get(`show_code_${i}`);
				const showDate = formData.get(`show_date_${i}`);
				const ticketsPurchased = parseInt(formData.get(`tickets_purchased_${i}`)) || 1;
				const amountPaid = parseFloat(formData.get(`amount_paid_${i}`)) || 0;
				const purchaseDate = formData.get(`purchase_date_${i}`) || null;
				const paymentMethod = formData.get(`payment_method_${i}`) || null;
				const notes = (formData.get(`notes_${i}`) || '').trim() || null;
				const promotionId = parseInt(formData.get(`promotion_id_${i}`)) || null;

				if (!showCode || !showDate) {
					skipped++;
					continue;
				}

				let patronId;

				if (mode === 'existing') {
					patronId = parseInt(formData.get(`patron_id_${i}`)) || 0;
					if (!patronId) {
						skipped++;
						continue;
					}
				} else {
					const firstName = (formData.get(`first_name_${i}`) || '').trim();
					const lastName = (formData.get(`last_name_${i}`) || '').trim();
					const email = (formData.get(`email_${i}`) || '').trim();
					const phone = (formData.get(`phone_${i}`) || '').trim();

					if (!firstName || !lastName) {
						skipped++;
						continue;
					}

					const result = await findOrCreatePatron(firstName, lastName, email, phone);
					patronId = result.id;
					if (result.created) newPatrons++;
				}

				await sql`
					INSERT INTO show_tickets (
						patron_id, show_code, show_date, tickets_purchased,
						amount_paid, purchase_date, payment_method, notes, promotion_id
					) VALUES (
						${patronId}, ${showCode}, ${showDate}, ${ticketsPurchased},
						${amountPaid}, ${purchaseDate}, ${paymentMethod}, ${notes}, ${promotionId}
					)
				`;

				results.push({ patron_id: patronId, show_code: showCode });
				saved++;
			}

			const parts = [`Saved ${saved} ticket purchase${saved !== 1 ? 's' : ''}`];
			if (newPatrons > 0) parts.push(`${newPatrons} new patron${newPatrons !== 1 ? 's' : ''} created`);
			if (skipped > 0) parts.push(`${skipped} incomplete row${skipped !== 1 ? 's' : ''} skipped`);

			return {
				success: true,
				action: 'manual',
				message: parts.join(', ') + '.'
			};
		} catch (error) {
			console.error('Error saving ticket purchases:', error);
			return { success: false, error: 'Failed to save: ' + error.message };
		}
	},

	// Step 1: Parse CSV → return data + event names for mapping
	csv_upload: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('csv_file');

		if (!file || typeof file === 'string') {
			return { success: false, error: 'Please select a CSV file.' };
		}

		try {
			const text = await file.text();
			const { rows, eventNames, discountCodes, format, hasAcctIds } = parseCSZReport(text);

			if (rows.length === 0) {
				return { success: false, error: 'No valid data rows found in the CSV.' };
			}

			return {
				success: true,
				action: 'csv_upload',
				rows,
				eventNames,
				discountCodes,
				csvFormat: format,
				totalRows: rows.length,
				rowsWithNames: rows.filter((r) => r.firstName || r.lastName).length,
				rowsAnonymous: rows.filter((r) => !r.firstName && !r.lastName).length,
				hasAddressData: format === 'new' || format === 'v2',
				hasAcctIds
			};
		} catch (error) {
			console.error('Error parsing CSV:', error);
			return { success: false, error: 'Failed to parse CSV: ' + error.message };
		}
	},

	// Step 2: After event mapping, detect patron conflicts
	csv_detect_conflicts: async ({ request }) => {
		const formData = await request.formData();
		const rowsJson = formData.get('rows_json')?.toString();
		const mappingsJson = formData.get('mappings_json')?.toString();
		const skipAnonymous = formData.get('skip_anonymous') === 'true';

		if (!rowsJson || !mappingsJson) {
			return { success: false, error: 'Missing data. Please re-upload.' };
		}

		let rows, mappings;
		try {
			rows = JSON.parse(rowsJson);
			mappings = JSON.parse(mappingsJson);
		} catch {
			return { success: false, error: 'Invalid data.' };
		}

		try {
			// Load all patrons including vbo_account_id
			const allPatrons = await sql`
				SELECT patron_id, first_name, last_name, email, phone, vbo_account_id
				FROM patrons
				ORDER BY last_name, first_name
			`;

			console.log(`[csv_conflicts] Checking ${rows.length} rows against ${allPatrons.length} patrons`);

			// Find unique patron entries that need resolution
			// Use AcctID as primary key if available, fallback to name+email
			const patronMap = new Map();
			for (const row of rows) {
				const showCode = mappings[row.eventName];
				if (!showCode || showCode === '__skip__') continue;

				const isAnonymous = !row.firstName && !row.lastName;
				if (isAnonymous && skipAnonymous) continue;
				if (isAnonymous) continue;

				// Dedup key: use AcctID if available, otherwise name+email
				const acctId = (row.acctId || '').trim();
				const key = acctId
					? `acct:${acctId}`
					: `name:${norm(row.firstName)}|${norm(row.lastName)}|${norm(row.email)}`;

				if (!patronMap.has(key)) {
					patronMap.set(key, row);
				}
			}

			const conflicts = [];
			const autoMatched = [];
			let acctIdMatched = 0;

			for (const [key, row] of patronMap) {
				const acctId = (row.acctId || '').trim();
				const matches = findPatronMatches(row, allPatrons);

				// AcctID match = definitive, auto-resolve
				if (acctId && matches.length > 0 && matches[0].matchType === 'acctid') {
					autoMatched.push({
						key,
						acctId,
						csvName: `${row.firstName} ${row.lastName}`,
						csvEmail: row.email || '',
						csvPhone: row.phone || '',
						patron_id: matches[0].patron_id,
						matchType: 'acctid'
					});
					acctIdMatched++;
				}
				// Single high-confidence match without AcctID
				else if (matches.length === 1 && matches[0].confidence >= 95) {
					autoMatched.push({
						key,
						acctId,
						csvName: `${row.firstName} ${row.lastName}`,
						csvEmail: row.email || '',
						csvPhone: row.phone || '',
						patron_id: matches[0].patron_id,
						matchType: matches[0].matchType
					});
				}
				// Ambiguous matches — user decides
				else if (matches.length > 0) {
					conflicts.push({
						key,
						acctId,
						csvName: `${row.firstName} ${row.lastName}`,
						csvEmail: row.email || '',
						csvPhone: row.phone || '',
						csvAddress: [row.address_line1, row.city, row.state, row.zip_code].filter(Boolean).join(', '),
						matches: matches.slice(0, 5)
					});
				}
				// No match — will be new patron
				else {
					autoMatched.push({
						key,
						acctId,
						csvName: `${row.firstName} ${row.lastName}`,
						csvEmail: row.email || '',
						csvPhone: row.phone || '',
						patron_id: null,
						matchType: 'new'
					});
				}
			}

			console.log(`[csv_conflicts] ${autoMatched.length} auto-resolved (${acctIdMatched} by AcctID), ${conflicts.length} need user input`);
			console.log(`[csv_conflicts] Auto-resolved: ${autoMatched.filter(a => a.patron_id).length} existing, ${autoMatched.filter(a => !a.patron_id).length} new`);

			return {
				success: true,
				action: 'csv_detect_conflicts',
				conflicts,
				autoMatched,
				autoMatchedExisting: autoMatched.filter((a) => a.patron_id).length,
				autoMatchedNew: autoMatched.filter((a) => !a.patron_id).length,
				acctIdMatched,
				conflictCount: conflicts.length
			};
		} catch (error) {
			console.error('Error detecting conflicts:', error);
			return { success: false, error: 'Conflict detection failed: ' + error.message };
		}
	},

	// Step 3: Final import with resolved patron decisions
	csv_import: async ({ request }) => {
		const formData = await request.formData();
		const rowsJson = formData.get('rows_json')?.toString();
		const mappingsJson = formData.get('mappings_json')?.toString();
		const promoMappingsJson = formData.get('promo_mappings_json')?.toString();
		const resolutionsJson = formData.get('resolutions_json')?.toString();
		const skipAnonymous = formData.get('skip_anonymous') === 'true';

		if (!rowsJson || !mappingsJson) {
			return { success: false, error: 'Missing import data. Please re-upload.' };
		}

		let rows, mappings, promoMappings, resolutions;
		try {
			rows = JSON.parse(rowsJson);
			mappings = JSON.parse(mappingsJson);
			promoMappings = promoMappingsJson ? JSON.parse(promoMappingsJson) : {};
			resolutions = resolutionsJson ? JSON.parse(resolutionsJson) : {};
		} catch {
			return { success: false, error: 'Invalid import data. Please re-upload.' };
		}

		let imported = 0;
		let skipped = 0;
		let patronsCreated = 0;
		let patronsUpdated = 0;
		let anonymousImported = 0;
		const skippedRows = []; // For the downloadable CSV
		const errors = [];

		try {
			for (const row of rows) {
				const showCode = mappings[row.eventName];

				if (!showCode || showCode === '__skip__') {
					skippedRows.push({ ...row, skipReason: 'Event skipped or unmapped' });
					skipped++;
					continue;
				}

				const isAnonymous = !row.firstName && !row.lastName;
				if (isAnonymous && skipAnonymous) {
					skippedRows.push({ ...row, skipReason: 'Anonymous row (skip anonymous enabled)' });
					skipped++;
					continue;
				}

				if (!row.showDate) {
					skippedRows.push({ ...row, skipReason: 'No show date' });
					skipped++;
					continue;
				}

				try {
					let patronId = null;

					if (!isAnonymous) {
						// Build key matching the conflict detection format
						const acctId = (row.acctId || '').trim();
						const key = acctId
							? `acct:${acctId}`
							: `name:${norm(row.firstName)}|${norm(row.lastName)}|${norm(row.email)}`;
						const resolution = resolutions[key];

						if (resolution) {
							if (resolution.action === 'skip') {
								skippedRows.push({ ...row, skipReason: 'User chose to skip patron' });
								skipped++;
								continue;
							} else if (resolution.action === 'use_existing') {
								patronId = resolution.patron_id;
								// Update address data on the existing patron if we have new data
								if (row.address_line1 || row.city || row.zip_code) {
									await updatePatronAddress(patronId, row);
									patronsUpdated++;
								}
							} else if (resolution.action === 'create_new') {
								patronId = await createPatronWithAddress(row);
								patronsCreated++;
							} else if (resolution.action === 'update_existing') {
								patronId = resolution.patron_id;
								await updatePatronFull(patronId, row);
								patronsUpdated++;
							}
						} else {
							// No explicit resolution — auto-match or create
							const result = await findOrCreatePatronWithAddress(row);
							patronId = result.id;
							if (result.created) patronsCreated++;
							if (result.updated) patronsUpdated++;
						}
					}

					// Determine promotion_id
					let promotionId = null;
					if (promoMappings['__event__' + row.eventName]) {
						promotionId = parseInt(promoMappings['__event__' + row.eventName]) || null;
					}
					if (row.discountCode && promoMappings[row.discountCode]) {
						promotionId = parseInt(promoMappings[row.discountCode]) || null;
					}

					await sql`
						INSERT INTO show_tickets (
							patron_id, show_code, show_date, tickets_purchased,
							amount_paid, purchase_date, payment_method, promotion_id
						) VALUES (
							${patronId}, ${showCode}, ${row.showDate}, ${row.qty},
							${row.itemTotal}, ${row.purchaseDate}, ${'Online'}, ${promotionId}
						)
					`;
					imported++;
					if (isAnonymous) anonymousImported++;
				} catch (rowError) {
					const label = isAnonymous ? 'Anonymous' : `${row.firstName} ${row.lastName}`;
					const errMsg = `${label} / ${row.eventName}: ${rowError.message}`;
					errors.push(errMsg);
					skippedRows.push({ ...row, skipReason: `Error: ${rowError.message}` });
					skipped++;
				}
			}

			// Build skip CSV content
			let skipCsvContent = '';
			if (skippedRows.length > 0) {
				const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Event', 'Show Date', 'Qty', 'Amount', 'Skip Reason'];
				skipCsvContent = headers.map((h) => `"${h}"`).join(',') + '\n';
				for (const sr of skippedRows) {
					const vals = [
						sr.firstName || '',
						sr.lastName || '',
						sr.email || '',
						sr.phone || '',
						sr.eventName || '',
						sr.showDate || '',
						sr.qty || '',
						sr.itemTotal || '',
						sr.skipReason || ''
					];
					skipCsvContent += vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
				}
			}

			return {
				success: true,
				action: 'csv_import',
				imported,
				skipped,
				patronsCreated,
				patronsUpdated,
				anonymousImported,
				errors: errors.slice(0, 20),
				skipCsvContent,
				skippedCount: skippedRows.length,
				message: `Imported ${imported} ticket purchases. ${patronsCreated} new patrons created, ${patronsUpdated} patrons updated.`
			};
		} catch (error) {
			console.error('Error importing tickets:', error);
			return { success: false, error: 'Import failed: ' + error.message };
		}
	}
};

// ============================================================
// PATRON CRUD HELPERS
// ============================================================

/**
 * Robustly find or create a patron. Uses a multi-tier lookup then
 * INSERT ... ON CONFLICT to handle race conditions and edge cases.
 * NEVER throws on duplicate — always returns a patron_id.
 */
async function findOrCreatePatron(firstName, lastName, email, phone, acctId) {
	const cleanEmail = email || null;
	const cleanPhone = phone || null;
	const cleanAcctId = (acctId || '').trim() || null;

	const patronId = await lookupPatron(firstName, lastName, cleanEmail, cleanPhone, cleanAcctId);
	if (patronId) {
		// Update phone/acctId if missing
		if (cleanPhone || cleanAcctId) {
			await sql`
				UPDATE patrons SET
					phone = CASE WHEN (phone IS NULL OR phone = '') AND ${cleanPhone || ''} != '' THEN ${cleanPhone} ELSE phone END,
					vbo_account_id = CASE WHEN (vbo_account_id IS NULL OR vbo_account_id = '') AND ${cleanAcctId || ''} != '' THEN ${cleanAcctId} ELSE vbo_account_id END,
					updated_at = CURRENT_TIMESTAMP
				WHERE patron_id = ${patronId}
			`;
		}
		return { id: patronId, created: false };
	}

	return await safeInsertPatron(firstName, lastName, cleanEmail, cleanPhone, null, null, null, null, null, null, cleanAcctId);
}

async function findOrCreatePatronWithAddress(row) {
	const cleanEmail = row.email || null;
	const cleanPhone = row.phone || null;
	const cleanAcctId = (row.acctId || '').trim() || null;

	const patronId = await lookupPatron(row.firstName, row.lastName, cleanEmail, cleanPhone, cleanAcctId);
	if (patronId) {
		// Fill in address data and acctId if empty
		let updated = false;
		if (row.address_line1 || row.city || row.zip_code || cleanPhone || cleanAcctId) {
			await sql`
				UPDATE patrons SET
					address_line1 = CASE WHEN (address_line1 IS NULL OR address_line1 = '') AND ${row.address_line1 || ''} != '' THEN ${row.address_line1 || ''} ELSE address_line1 END,
					address_line2 = CASE WHEN (address_line2 IS NULL OR address_line2 = '') AND ${row.address_line2 || ''} != '' THEN ${row.address_line2 || ''} ELSE address_line2 END,
					city = CASE WHEN (city IS NULL OR city = '') AND ${row.city || ''} != '' THEN ${row.city || ''} ELSE city END,
					state = CASE WHEN (state IS NULL OR state = '') AND ${row.state || ''} != '' THEN ${row.state || ''} ELSE state END,
					zip_code = CASE WHEN (zip_code IS NULL OR zip_code = '') AND ${row.zip_code || ''} != '' THEN ${row.zip_code || ''} ELSE zip_code END,
					country = CASE WHEN (country IS NULL OR country = '') AND ${row.country || ''} != '' THEN ${row.country || ''} ELSE country END,
					phone = CASE WHEN (phone IS NULL OR phone = '') AND ${cleanPhone || ''} != '' THEN ${cleanPhone || ''} ELSE phone END,
					vbo_account_id = CASE WHEN (vbo_account_id IS NULL OR vbo_account_id = '') AND ${cleanAcctId || ''} != '' THEN ${cleanAcctId || ''} ELSE vbo_account_id END,
					updated_at = CURRENT_TIMESTAMP
				WHERE patron_id = ${patronId}
			`;
			updated = true;
		}
		return { id: patronId, created: false, updated };
	}

	const result = await safeInsertPatron(
		row.firstName, row.lastName, cleanEmail, cleanPhone,
		row.address_line1, row.address_line2, row.city, row.state, row.zip_code, row.country,
		cleanAcctId
	);
	return { ...result, updated: false };
}

async function createPatronWithAddress(row) {
	const cleanAcctId = (row.acctId || '').trim() || null;
	const result = await safeInsertPatron(
		row.firstName, row.lastName, row.email || null, row.phone || null,
		row.address_line1, row.address_line2, row.city, row.state, row.zip_code, row.country,
		cleanAcctId
	);
	return result.id;
}

/**
 * Multi-tier patron lookup:
 * 0. VBO Account ID (if provided) — definitive match
 * 1. Exact name + email
 * 2. Email only (if provided)
 * 3. Name only
 * 4. Name + phone
 * Returns patron_id or null.
 */
async function lookupPatron(firstName, lastName, email, phone, acctId) {
	const fLower = firstName.toLowerCase().trim();
	const lLower = lastName.toLowerCase().trim();

	// 0. VBO Account ID — definitive
	if (acctId) {
		const acctMatch = await sql`
			SELECT patron_id FROM patrons
			WHERE vbo_account_id = ${acctId}
			LIMIT 1
		`;
		if (acctMatch.length > 0) return acctMatch[0].patron_id;
	}

	// 1. Exact name + email
	const exact = await sql`
		SELECT patron_id FROM patrons
		WHERE LOWER(TRIM(first_name)) = ${fLower}
			AND LOWER(TRIM(last_name)) = ${lLower}
			AND (
				(email IS NULL AND ${email}::text IS NULL)
				OR LOWER(TRIM(email)) = LOWER(TRIM(${email}))
			)
		LIMIT 1
	`;
	if (exact.length > 0) return exact[0].patron_id;

	// 2. Email only
	if (email) {
		const emailMatch = await sql`
			SELECT patron_id FROM patrons
			WHERE LOWER(TRIM(email)) = LOWER(TRIM(${email}))
			LIMIT 1
		`;
		if (emailMatch.length > 0) return emailMatch[0].patron_id;
	}

	// 3. Name only
	const nameMatch = await sql`
		SELECT patron_id FROM patrons
		WHERE LOWER(TRIM(first_name)) = ${fLower}
			AND LOWER(TRIM(last_name)) = ${lLower}
		LIMIT 1
	`;
	if (nameMatch.length > 0) return nameMatch[0].patron_id;

	// 4. Name + phone
	if (phone) {
		const phoneMatch = await sql`
			SELECT patron_id FROM patrons
			WHERE LOWER(TRIM(first_name)) = ${fLower}
				AND LOWER(TRIM(last_name)) = ${lLower}
				AND TRIM(phone) = TRIM(${phone})
			LIMIT 1
		`;
		if (phoneMatch.length > 0) return phoneMatch[0].patron_id;
	}

	return null;
}

/**
 * Insert a patron, handling duplicate key gracefully.
 * If the insert fails due to unique constraint, finds and returns the existing patron.
 */
async function safeInsertPatron(firstName, lastName, email, phone, addr1, addr2, city, state, zip, country, acctId) {
	try {
		const [newPatron] = await sql`
			INSERT INTO patrons (first_name, last_name, email, phone, address_line1, address_line2, city, state, zip_code, country, vbo_account_id)
			VALUES (
				${firstName}, ${lastName}, ${email || null}, ${phone || null},
				${addr1 || null}, ${addr2 || null}, ${city || null},
				${state || null}, ${zip || null}, ${country || null},
				${acctId || null}
			)
			RETURNING patron_id
		`;
		return { id: newPatron.patron_id, created: true };
	} catch (err) {
		// Unique constraint violation — find the existing patron
		if (err.code === '23505') {
			console.log(`[safeInsertPatron] Duplicate caught for "${firstName} ${lastName}" (${email}) acctId=${acctId}, looking up existing...`);
			const patronId = await lookupPatron(firstName, lastName, email, phone, acctId);
			if (patronId) {
				// Store AcctID on the existing patron if we have it and they don't
				if (acctId) {
					await sql`
						UPDATE patrons SET vbo_account_id = COALESCE(vbo_account_id, ${acctId}), updated_at = CURRENT_TIMESTAMP
						WHERE patron_id = ${patronId} AND (vbo_account_id IS NULL OR vbo_account_id = '')
					`;
				}
				return { id: patronId, created: false };
			}
			// Last resort: broader search
			const [fallback] = await sql`
				SELECT patron_id FROM patrons
				WHERE LOWER(TRIM(first_name)) = ${firstName.toLowerCase().trim()}
					AND LOWER(TRIM(last_name)) = ${lastName.toLowerCase().trim()}
				ORDER BY patron_id ASC
				LIMIT 1
			`;
			if (fallback) {
				return { id: fallback.patron_id, created: false };
			}
		}
		throw err;
	}
}

async function updatePatronAddress(patronId, row) {
	await sql`
		UPDATE patrons SET
			address_line1 = CASE WHEN (address_line1 IS NULL OR address_line1 = '') AND ${row.address_line1 || ''} != '' THEN ${row.address_line1 || ''} ELSE address_line1 END,
			address_line2 = CASE WHEN (address_line2 IS NULL OR address_line2 = '') AND ${row.address_line2 || ''} != '' THEN ${row.address_line2 || ''} ELSE address_line2 END,
			city = CASE WHEN (city IS NULL OR city = '') AND ${row.city || ''} != '' THEN ${row.city || ''} ELSE city END,
			state = CASE WHEN (state IS NULL OR state = '') AND ${row.state || ''} != '' THEN ${row.state || ''} ELSE state END,
			zip_code = CASE WHEN (zip_code IS NULL OR zip_code = '') AND ${row.zip_code || ''} != '' THEN ${row.zip_code || ''} ELSE zip_code END,
			country = CASE WHEN (country IS NULL OR country = '') AND ${row.country || ''} != '' THEN ${row.country || ''} ELSE country END,
			updated_at = CURRENT_TIMESTAMP
		WHERE patron_id = ${patronId}
	`;
}

async function updatePatronFull(patronId, row) {
	const cleanAcctId = (row.acctId || '').trim() || null;
	await sql`
		UPDATE patrons SET
			first_name = ${row.firstName},
			last_name = ${row.lastName},
			email = CASE WHEN ${row.email || ''} != '' THEN ${row.email} ELSE email END,
			phone = CASE WHEN ${row.phone || ''} != '' THEN ${row.phone} ELSE phone END,
			address_line1 = CASE WHEN ${row.address_line1 || ''} != '' THEN ${row.address_line1} ELSE address_line1 END,
			address_line2 = CASE WHEN ${row.address_line2 || ''} != '' THEN ${row.address_line2} ELSE address_line2 END,
			city = CASE WHEN ${row.city || ''} != '' THEN ${row.city} ELSE city END,
			state = CASE WHEN ${row.state || ''} != '' THEN ${row.state} ELSE state END,
			zip_code = CASE WHEN ${row.zip_code || ''} != '' THEN ${row.zip_code} ELSE zip_code END,
			country = CASE WHEN ${row.country || ''} != '' THEN ${row.country} ELSE country END,
			vbo_account_id = CASE WHEN ${cleanAcctId || ''} != '' THEN ${cleanAcctId} ELSE vbo_account_id END,
			updated_at = CURRENT_TIMESTAMP
		WHERE patron_id = ${patronId}
	`;
}