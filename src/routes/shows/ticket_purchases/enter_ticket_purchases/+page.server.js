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
// CSV PARSING — auto-detects old (16 field) vs new (22 field) vs v2 (23 field) format
// ============================================================

function parseCSZReport(text) {
	// Normalize line endings
	text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

	// Rebuild lines respecting quoted fields (handles newlines inside quotes)
	const rawLines = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char === '"') {
			inQuotes = !inQuotes;
			current += char;
		} else if (char === '\n' && !inQuotes) {
			if (current.trim()) rawLines.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	if (current.trim()) rawLines.push(current);

	const rows = [];
	const eventNamesSet = new Set();
	const discountCodesSet = new Set();
	let detectedFormat = null;

	for (const line of rawLines) {
		if (!line.match(/^"[0-9]+\./)) continue;

		const fields = parseCSVLine(line);

		// Auto-detect format on first data row
		// v3 = 24 fields (AcctID + address + Mobile Phone)
		// v2 = 23 fields (AcctID + address, no Mobile Phone)
		// new = 22 fields (address, no AcctID)
		// old = 16 fields (no address, no AcctID)
		if (detectedFormat === null) {
			if (fields.length >= 24) {
				detectedFormat = 'v3';
			} else if (fields.length >= 23) {
				detectedFormat = 'v2';
			} else if (fields.length >= 21) {
				detectedFormat = 'new';
			} else if (fields.length >= 15) {
				detectedFormat = 'old';
			} else {
				continue;
			}
			console.log(`[csv_parse] Detected ${detectedFormat} format (${fields.length} fields)`);
		}

		let row;
		if (detectedFormat === 'v3') {
			// 0:Rec, 1:AcctID, 2:First, 3:Last, 4:Address, 5:Address2, 6:City, 7:State, 8:Zip, 9:Country,
			// 10:Email, 11:Phone, 12:MobilePhone, 13:EventName, 14:Venue, 15:EventDate, 16:Qty, 17:DiscountCode,
			// 18:DiscountValue, 19:Orders, 20:DateCreated, 21:DateScanned, 22:ItemTotal
			if (fields.length < 23) continue;
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
				mobile_phone: (fields[12] || '').trim(),
				eventName: fields[13] || '',
				eventDateStr: fields[15] || '',
				qty: parseInt(fields[16]) || 0,
				discountCode: fields[17] || '',
				discountValue: parseFloat(fields[18]) || 0,
				dateCreated: fields[20] || '',
				itemTotal: parseFloat(fields[22]) || 0
			};
		} else if (detectedFormat === 'v2') {
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
				mobile_phone: '',
				eventName: fields[12] || '',
				eventDateStr: fields[14] || '',
				qty: parseInt(fields[15]) || 0,
				discountCode: fields[16] || '',
				discountValue: parseFloat(fields[17]) || 0,
				dateCreated: fields[19] || '',
				itemTotal: parseFloat(fields[21]) || 0
			};
		} else if (detectedFormat === 'new') {
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
				mobile_phone: '',
				eventName: fields[11] || '',
				eventDateStr: fields[13] || '',
				qty: parseInt(fields[14]) || 0,
				discountCode: fields[15] || '',
				discountValue: parseFloat(fields[16]) || 0,
				dateCreated: fields[18] || '',
				itemTotal: parseFloat(fields[20]) || 0
			};
		} else {
			if (fields.length < 15) continue;
			row = {
				acctId: '',
				firstName: fields[1] || '',
				lastName: fields[2] || '',
				email: fields[3] || '',
				phone: fields[4] || '',
				mobile_phone: '',
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

		// Clean phone fields
		if (row.phone === ' ' || row.phone === '') row.phone = '';
		if (row.mobile_phone === ' ' || row.mobile_phone === '') row.mobile_phone = '';
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
// ACTIONS
// ============================================================

const norm = (s) => (s || '').toLowerCase().trim();

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

	// Step 1: Parse CSV → return data + event names for mapping (client-side mapping UI)
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

	// Step 2: After event mapping, match patrons and return results for review
	// (Mirrors the student registration csv_check pattern)
	csv_check: async ({ request }) => {
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
			const matchResults = [];

			// Deduplicate patrons — same person may have multiple ticket rows
			const patronMap = new Map();
			for (const row of rows) {
				const showCode = mappings[row.eventName];
				if (!showCode || showCode === '__skip__') continue;

				const isAnonymous = !row.firstName && !row.lastName;
				if (isAnonymous && skipAnonymous) continue;
				if (isAnonymous) continue;

				const acctId = (row.acctId || '').trim();
				const key = acctId
					? `acct:${acctId}`
					: `name:${norm(row.firstName)}|${norm(row.lastName)}|${norm(row.email)}`;

				if (!patronMap.has(key)) {
					patronMap.set(key, row);
				}
			}

			// Match each unique patron against the database
			for (const [key, row] of patronMap) {
				const email = norm(row.email);
				const firstName = (row.firstName || '').trim();
				const lastName = (row.lastName || '').trim();
				const phone = (row.phone || '').trim();
				const acctId = (row.acctId || '').trim();

				let matchType = 'new';
				let dbPatron = null;

				// 1. Try AcctID match (definitive)
				if (acctId) {
					const acctMatch = await sql`
						SELECT patron_id, first_name, last_name, email, phone, mobile_phone, vbo_account_id,
						       address_line1, city, state, zip_code
						FROM patrons
						WHERE vbo_account_id = ${acctId}
						LIMIT 1
					`;
					if (acctMatch.length > 0) {
						dbPatron = mapPatronRow(acctMatch[0]);
						matchType = 'acctid_match';
					}
				}

				// 2. Try email match
				if (!dbPatron && email) {
					const emailMatch = await sql`
						SELECT patron_id, first_name, last_name, email, phone, mobile_phone, vbo_account_id,
						       address_line1, city, state, zip_code
						FROM patrons
						WHERE LOWER(TRIM(email)) = ${email}
						LIMIT 1
					`;
					if (emailMatch.length > 0) {
						dbPatron = mapPatronRow(emailMatch[0]);
						matchType = 'email_match';
					}
				}

				// 3. Try name match
				if (!dbPatron && firstName && lastName) {
					const nameMatch = await sql`
						SELECT patron_id, first_name, last_name, email, phone, mobile_phone, vbo_account_id,
						       address_line1, city, state, zip_code
						FROM patrons
						WHERE LOWER(TRIM(first_name)) = ${firstName.toLowerCase()}
						  AND LOWER(TRIM(last_name)) = ${lastName.toLowerCase()}
						LIMIT 1
					`;
					if (nameMatch.length > 0) {
						dbPatron = mapPatronRow(nameMatch[0]);
						matchType = 'name_match';
					}
				}

				// Check for existing ticket for this patron+show (to detect duplicates)
				let existingTicket = null;
				if (dbPatron) {
					const showCode = mappings[row.eventName];
					if (showCode && row.showDate) {
						const ticketMatch = await sql`
							SELECT ticket_id, show_code, show_date, tickets_purchased, amount_paid
							FROM show_tickets
							WHERE patron_id = ${dbPatron.patron_id}
							  AND show_code = ${showCode}
							  AND show_date = ${row.showDate}
							LIMIT 1
						`;
						if (ticketMatch.length > 0) {
							existingTicket = {
								ticket_id: ticketMatch[0].ticket_id,
								show_code: ticketMatch[0].show_code,
								show_date: ticketMatch[0].show_date
									? ticketMatch[0].show_date.toISOString().split('T')[0]
									: null,
								tickets_purchased: Number(ticketMatch[0].tickets_purchased),
								amount_paid: Number(ticketMatch[0].amount_paid)
							};
						}
					}
				}

				// Build field diffs for review
				const diffs = [];
				if (dbPatron) {
					if (firstName && norm(firstName) !== norm(dbPatron.first_name)) {
						diffs.push({ field: 'first_name', db: dbPatron.first_name, csv: firstName });
					}
					if (lastName && norm(lastName) !== norm(dbPatron.last_name)) {
						diffs.push({ field: 'last_name', db: dbPatron.last_name, csv: lastName });
					}
					if (email && norm(email) !== norm(dbPatron.email)) {
						diffs.push({ field: 'email', db: dbPatron.email || '', csv: row.email });
					}
					if (phone && norm(phone) !== norm(dbPatron.phone)) {
						diffs.push({ field: 'phone', db: dbPatron.phone || '', csv: phone });
					}
					const csvMobile = (row.mobile_phone || '').trim();
					if (csvMobile && norm(csvMobile) !== norm(dbPatron.mobile_phone)) {
						diffs.push({ field: 'mobile_phone', db: dbPatron.mobile_phone || '', csv: csvMobile });
					}
					// Address diffs — only if CSV has data and DB is empty
					if (row.address_line1 && !dbPatron.address_line1) {
						diffs.push({ field: 'address', db: '(empty)', csv: [row.address_line1, row.city, row.state, row.zip_code].filter(Boolean).join(', ') });
					}
				}

				matchResults.push({
					key,
					csv: {
						first_name: firstName,
						last_name: lastName,
						email: row.email || '',
						phone,
						mobile_phone: (row.mobile_phone || '').trim(),
						acct_id: acctId,
						address_line1: row.address_line1 || '',
						city: row.city || '',
						state: row.state || '',
						zip_code: row.zip_code || ''
					},
					matchType,
					dbPatron,
					existingTicket,
					diffs
				});
			}

			return {
				success: true,
				action: 'csv_check',
				matchResults
			};
		} catch (error) {
			console.error('Error checking patrons:', error);
			return { success: false, error: 'Patron matching failed: ' + error.message };
		}
	},

	// Step 3: Final import with patron decisions
	csv_confirm: async ({ request }) => {
		const formData = await request.formData();
		const rowsJson = formData.get('rows_json')?.toString();
		const mappingsJson = formData.get('mappings_json')?.toString();
		const promoMappingsJson = formData.get('promo_mappings_json')?.toString();
		const decisionsJson = formData.get('decisions_json')?.toString();
		const skipAnonymous = formData.get('skip_anonymous') === 'true';

		if (!rowsJson || !mappingsJson || !decisionsJson) {
			return { success: false, error: 'Missing import data. Please re-upload.' };
		}

		let rows, mappings, promoMappings, decisions;
		try {
			rows = JSON.parse(rowsJson);
			mappings = JSON.parse(mappingsJson);
			promoMappings = promoMappingsJson ? JSON.parse(promoMappingsJson) : {};
			decisions = JSON.parse(decisionsJson);
		} catch {
			return { success: false, error: 'Invalid import data.' };
		}

		// Build a lookup from patron key → decision
		const decisionMap = {};
		for (const d of decisions) {
			decisionMap[d.key] = d;
		}

		let imported = 0;
		let skipped = 0;
		let patronsCreated = 0;
		let patronsUpdated = 0;
		let anonymousImported = 0;
		const skippedRows = [];
		const errors = [];

		try {
			// Cache patron_id lookups so we don't create duplicates within the same import
			const patronCache = {};

			for (const row of rows) {
				const showCode = mappings[row.eventName];

				if (!showCode || showCode === '__skip__') {
					skippedRows.push({ ...row, skipReason: 'Event skipped or unmapped' });
					skipped++;
					continue;
				}

				const isAnonymous = !row.firstName && !row.lastName;
				if (isAnonymous && skipAnonymous) {
					skippedRows.push({ ...row, skipReason: 'Anonymous (skip enabled)' });
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
						const acctId = (row.acctId || '').trim();
						const key = acctId
							? `acct:${acctId}`
							: `name:${norm(row.firstName)}|${norm(row.lastName)}|${norm(row.email)}`;

						// Check cache first
						if (patronCache[key]) {
							patronId = patronCache[key];
						} else {
							const decision = decisionMap[key];

							if (decision) {
								if (decision.action === 'skip') {
									skippedRows.push({ ...row, skipReason: 'Patron skipped by user' });
									skipped++;
									continue;
								} else if (decision.action === 'use_existing' && decision.patron_id) {
									patronId = decision.patron_id;
									// Fill in address/phone/acctId if empty
									await fillPatronData(patronId, row);
								} else if (decision.action === 'update_existing' && decision.patron_id) {
									patronId = decision.patron_id;
									await updatePatronFull(patronId, row);
									patronsUpdated++;
								} else {
									// 'create_new' or no decision — auto-match or create
									const result = await findOrCreatePatronWithAddress(row);
									patronId = result.id;
									if (result.created) patronsCreated++;
									if (result.updated) patronsUpdated++;
								}
							} else {
								// No decision for this key — auto-match or create
								const result = await findOrCreatePatronWithAddress(row);
								patronId = result.id;
								if (result.created) patronsCreated++;
								if (result.updated) patronsUpdated++;
							}

							if (patronId) patronCache[key] = patronId;
						}

						// Apply field updates if user checked them
						const decision = decisionMap[key];
						if (decision && decision.updateFields && decision.updateFields.length > 0 && patronId) {
							for (const field of decision.updateFields) {
								if (field === 'first_name') {
									await sql`UPDATE patrons SET first_name = ${row.firstName}, updated_at = CURRENT_TIMESTAMP WHERE patron_id = ${patronId}`;
								} else if (field === 'last_name') {
									await sql`UPDATE patrons SET last_name = ${row.lastName}, updated_at = CURRENT_TIMESTAMP WHERE patron_id = ${patronId}`;
								} else if (field === 'email') {
									await sql`UPDATE patrons SET email = ${row.email || ''}, updated_at = CURRENT_TIMESTAMP WHERE patron_id = ${patronId}`;
								} else if (field === 'phone') {
									await sql`UPDATE patrons SET phone = ${row.phone}, updated_at = CURRENT_TIMESTAMP WHERE patron_id = ${patronId}`;
								} else if (field === 'mobile_phone') {
									await sql`UPDATE patrons SET mobile_phone = ${row.mobile_phone || ''}, updated_at = CURRENT_TIMESTAMP WHERE patron_id = ${patronId}`;
								} else if (field === 'address') {
									await fillPatronData(patronId, row);
								}
							}
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
					errors.push(`${label} / ${row.eventName}: ${rowError.message}`);
					skippedRows.push({ ...row, skipReason: `Error: ${rowError.message}` });
					skipped++;
				}
			}

			// Build skip CSV
			let skipCsvContent = '';
			if (skippedRows.length > 0) {
				const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Event', 'Show Date', 'Qty', 'Amount', 'Skip Reason'];
				skipCsvContent = headers.map((h) => `"${h}"`).join(',') + '\n';
				for (const sr of skippedRows) {
					const vals = [
						sr.firstName || '', sr.lastName || '', sr.email || '', sr.phone || '',
						sr.eventName || '', sr.showDate || '', sr.qty || '', sr.itemTotal || '',
						sr.skipReason || ''
					];
					skipCsvContent += vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
				}
			}

			return {
				success: true,
				action: 'csv_confirm',
				imported,
				skipped,
				patronsCreated,
				patronsUpdated,
				anonymousImported,
				errors: errors.slice(0, 20),
				skipCsvContent,
				skippedCount: skippedRows.length,
				message: `Imported ${imported} ticket purchase${imported !== 1 ? 's' : ''}. ${patronsCreated} new patron${patronsCreated !== 1 ? 's' : ''} created, ${patronsUpdated} updated.`
			};
		} catch (error) {
			console.error('Error importing tickets:', error);
			return { success: false, error: 'Import failed: ' + error.message };
		}
	}
};

// ============================================================
// PATRON HELPERS
// ============================================================

function mapPatronRow(r) {
	return {
		patron_id: r.patron_id,
		first_name: r.first_name,
		last_name: r.last_name,
		email: r.email || '',
		phone: r.phone || '',
		mobile_phone: r.mobile_phone || '',
		vbo_account_id: r.vbo_account_id || '',
		address_line1: r.address_line1 || '',
		city: r.city || '',
		state: r.state || '',
		zip_code: r.zip_code || ''
	};
}

async function fillPatronData(patronId, row) {
	const cleanPhone = row.phone || '';
	const cleanMobile = row.mobile_phone || '';
	const cleanAcctId = (row.acctId || '').trim();
	await sql`
		UPDATE patrons SET
			address_line1 = CASE WHEN (address_line1 IS NULL OR address_line1 = '') AND ${row.address_line1 || ''} != '' THEN ${row.address_line1 || ''} ELSE address_line1 END,
			address_line2 = CASE WHEN (address_line2 IS NULL OR address_line2 = '') AND ${row.address_line2 || ''} != '' THEN ${row.address_line2 || ''} ELSE address_line2 END,
			city = CASE WHEN (city IS NULL OR city = '') AND ${row.city || ''} != '' THEN ${row.city || ''} ELSE city END,
			state = CASE WHEN (state IS NULL OR state = '') AND ${row.state || ''} != '' THEN ${row.state || ''} ELSE state END,
			zip_code = CASE WHEN (zip_code IS NULL OR zip_code = '') AND ${row.zip_code || ''} != '' THEN ${row.zip_code || ''} ELSE zip_code END,
			country = CASE WHEN (country IS NULL OR country = '') AND ${row.country || ''} != '' THEN ${row.country || ''} ELSE country END,
			phone = CASE WHEN (phone IS NULL OR phone = '') AND ${cleanPhone} != '' THEN ${cleanPhone} ELSE phone END,
			mobile_phone = CASE WHEN (mobile_phone IS NULL OR mobile_phone = '') AND ${cleanMobile} != '' THEN ${cleanMobile} ELSE mobile_phone END,
			vbo_account_id = CASE WHEN (vbo_account_id IS NULL OR vbo_account_id = '') AND ${cleanAcctId} != '' THEN ${cleanAcctId} ELSE vbo_account_id END,
			updated_at = CURRENT_TIMESTAMP
		WHERE patron_id = ${patronId}
	`;
}

async function updatePatronFull(patronId, row) {
	const cleanAcctId = (row.acctId || '').trim() || null;
	const cleanMobile = (row.mobile_phone || '').trim();
	await sql`
		UPDATE patrons SET
			first_name = ${row.firstName},
			last_name = ${row.lastName},
			email = CASE WHEN ${row.email || ''} != '' THEN ${row.email} ELSE email END,
			phone = CASE WHEN ${row.phone || ''} != '' THEN ${row.phone} ELSE phone END,
			mobile_phone = CASE WHEN ${cleanMobile} != '' THEN ${cleanMobile} ELSE mobile_phone END,
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

async function findOrCreatePatronWithAddress(row) {
	const cleanEmail = row.email || null;
	const cleanPhone = row.phone || null;
	const cleanAcctId = (row.acctId || '').trim() || null;

	const patronId = await lookupPatron(row.firstName, row.lastName, cleanEmail, cleanPhone, cleanAcctId);
	if (patronId) {
		let updated = false;
		if (row.address_line1 || row.city || row.zip_code || cleanPhone || cleanAcctId) {
			await fillPatronData(patronId, row);
			updated = true;
		}
		return { id: patronId, created: false, updated };
	}

	return await safeInsertPatron(
		row.firstName, row.lastName, cleanEmail, cleanPhone,
		row.address_line1, row.address_line2, row.city, row.state, row.zip_code, row.country,
		cleanAcctId
	);
}

async function findOrCreatePatron(firstName, lastName, email, phone) {
	const cleanEmail = email || null;
	const cleanPhone = phone || null;

	const patronId = await lookupPatron(firstName, lastName, cleanEmail, cleanPhone, null);
	if (patronId) {
		if (cleanPhone) {
			await sql`
				UPDATE patrons SET
					phone = CASE WHEN (phone IS NULL OR phone = '') AND ${cleanPhone} != '' THEN ${cleanPhone} ELSE phone END,
					updated_at = CURRENT_TIMESTAMP
				WHERE patron_id = ${patronId}
			`;
		}
		return { id: patronId, created: false };
	}

	return await safeInsertPatron(firstName, lastName, cleanEmail, cleanPhone, null, null, null, null, null, null, null);
}

async function lookupPatron(firstName, lastName, email, phone, acctId) {
	const fLower = firstName.toLowerCase().trim();
	const lLower = lastName.toLowerCase().trim();

	// 0. VBO Account ID — definitive
	if (acctId) {
		const acctMatch = await sql`SELECT patron_id FROM patrons WHERE vbo_account_id = ${acctId} LIMIT 1`;
		if (acctMatch.length > 0) return acctMatch[0].patron_id;
	}

	// 1. Exact name + email
	if (email) {
		const exact = await sql`
			SELECT patron_id FROM patrons
			WHERE LOWER(TRIM(first_name)) = ${fLower}
			  AND LOWER(TRIM(last_name)) = ${lLower}
			  AND LOWER(TRIM(email)) = LOWER(TRIM(${email}))
			LIMIT 1
		`;
		if (exact.length > 0) return exact[0].patron_id;
	}

	// 2. Email only
	if (email) {
		const emailMatch = await sql`
			SELECT patron_id FROM patrons WHERE LOWER(TRIM(email)) = LOWER(TRIM(${email})) LIMIT 1
		`;
		if (emailMatch.length > 0) return emailMatch[0].patron_id;
	}

	// 3. Name only
	const nameMatch = await sql`
		SELECT patron_id FROM patrons
		WHERE LOWER(TRIM(first_name)) = ${fLower} AND LOWER(TRIM(last_name)) = ${lLower}
		LIMIT 1
	`;
	if (nameMatch.length > 0) return nameMatch[0].patron_id;

	return null;
}

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
		return { id: newPatron.patron_id, created: true, updated: false };
	} catch (err) {
		if (err.code === '23505') {
			const patronId = await lookupPatron(firstName, lastName, email, phone, acctId);
			if (patronId) {
				if (acctId) {
					await sql`
						UPDATE patrons SET vbo_account_id = COALESCE(vbo_account_id, ${acctId}), updated_at = CURRENT_TIMESTAMP
						WHERE patron_id = ${patronId} AND (vbo_account_id IS NULL OR vbo_account_id = '')
					`;
				}
				return { id: patronId, created: false, updated: false };
			}
			const [fallback] = await sql`
				SELECT patron_id FROM patrons
				WHERE LOWER(TRIM(first_name)) = ${firstName.toLowerCase().trim()}
				  AND LOWER(TRIM(last_name)) = ${lastName.toLowerCase().trim()}
				ORDER BY patron_id ASC LIMIT 1
			`;
			if (fallback) return { id: fallback.patron_id, created: false, updated: false };
		}
		throw err;
	}
}