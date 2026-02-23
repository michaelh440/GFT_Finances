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
			SELECT patron_id, first_name, last_name, email
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

/**
 * Find or create a patron by name + email
 */
async function findOrCreatePatron(firstName, lastName, email, phone) {
	const cleanEmail = email || null;
	const cleanPhone = phone || null;

	const exact = await sql`
		SELECT patron_id FROM patrons
		WHERE LOWER(first_name) = ${firstName.toLowerCase()}
			AND LOWER(last_name) = ${lastName.toLowerCase()}
			AND (
				(email IS NULL AND ${cleanEmail}::text IS NULL)
				OR LOWER(email) = LOWER(${cleanEmail})
			)
		LIMIT 1
	`;

	if (exact.length > 0) {
		if (cleanPhone) {
			await sql`
				UPDATE patrons SET phone = COALESCE(NULLIF(phone, ''), ${cleanPhone}), updated_at = CURRENT_TIMESTAMP
				WHERE patron_id = ${exact[0].patron_id}
			`;
		}
		return { id: exact[0].patron_id, created: false };
	}

	if (cleanEmail) {
		const emailMatch = await sql`
			SELECT patron_id FROM patrons WHERE LOWER(email) = LOWER(${cleanEmail}) LIMIT 1
		`;
		if (emailMatch.length > 0) {
			return { id: emailMatch[0].patron_id, created: false };
		}
	}

	const [newPatron] = await sql`
		INSERT INTO patrons (first_name, last_name, email, phone)
		VALUES (${firstName}, ${lastName}, ${cleanEmail}, ${cleanPhone})
		RETURNING patron_id
	`;

	return { id: newPatron.patron_id, created: true };
}

export const actions = {
	// Manual row entry
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

	// CSV Upload: parse and return data for client-side mapping
	csv_upload: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('csv_file');

		if (!file || typeof file === 'string') {
			return { success: false, error: 'Please select a CSV file.' };
		}

		try {
			const text = await file.text();
			const { rows, eventNames, discountCodes } = parseCSZReport(text);

			if (rows.length === 0) {
				return { success: false, error: 'No valid data rows found in the CSV.' };
			}

			return {
				success: true,
				action: 'csv_upload',
				rows,
				eventNames,
				discountCodes,
				totalRows: rows.length,
				rowsWithNames: rows.filter((r) => r.firstName || r.lastName).length,
				rowsAnonymous: rows.filter((r) => !r.firstName && !r.lastName).length
			};
		} catch (error) {
			console.error('Error parsing CSV:', error);
			return { success: false, error: 'Failed to parse CSV: ' + error.message };
		}
	},

	// CSV Import: save with event-to-show mappings + promotion mappings
	csv_import: async ({ request }) => {
		const formData = await request.formData();
		const rowsJson = formData.get('rows_json')?.toString();
		const mappingsJson = formData.get('mappings_json')?.toString();
		const promoMappingsJson = formData.get('promo_mappings_json')?.toString();
		const skipAnonymous = formData.get('skip_anonymous') === 'true';

		if (!rowsJson || !mappingsJson) {
			return { success: false, error: 'Missing import data. Please re-upload.' };
		}

		let rows, mappings, promoMappings;
		try {
			rows = JSON.parse(rowsJson);
			mappings = JSON.parse(mappingsJson);
			promoMappings = promoMappingsJson ? JSON.parse(promoMappingsJson) : {};
		} catch {
			return { success: false, error: 'Invalid import data. Please re-upload.' };
		}

		let imported = 0;
		let skipped = 0;
		let patronsCreated = 0;
		let anonymousImported = 0;
		const errors = [];

		try {
			for (const row of rows) {
				const showCode = mappings[row.eventName];

				if (!showCode || showCode === '__skip__') {
					skipped++;
					continue;
				}

				const isAnonymous = !row.firstName && !row.lastName;
				if (isAnonymous && skipAnonymous) {
					skipped++;
					continue;
				}

				try {
					let patronId = null;

					if (!isAnonymous) {
						const result = await findOrCreatePatron(
							row.firstName, row.lastName,
							row.email || null,
							row.phone || null
						);
						patronId = result.id;
						if (result.created) patronsCreated++;
					}

					// Determine promotion_id:
					// 1. If the event itself is mapped as a promotion (e.g. "Summer Ticket Sale" → promo)
					// 2. If the row's discount code is mapped to a promotion
					let promotionId = null;

					// Check event-level promotion mapping first
					if (promoMappings['__event__' + row.eventName]) {
						promotionId = parseInt(promoMappings['__event__' + row.eventName]) || null;
					}

					// Then check discount code mapping (row-level takes precedence)
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
					skipped++;
				}
			}

			return {
				success: true,
				action: 'csv_import',
				imported,
				skipped,
				patronsCreated,
				anonymousImported,
				errors: errors.slice(0, 20)
			};
		} catch (error) {
			console.error('Error importing tickets:', error);
			return { success: false, error: 'Import failed: ' + error.message };
		}
	}
};

/**
 * Parse CSZ Past Event Sales report CSV format
 */
function parseCSZReport(text) {
	const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const rows = [];
	const eventNamesSet = new Set();
	const discountCodesSet = new Set();

	for (const line of lines) {
		if (!line.match(/^"[0-9]+\./)) continue;

		const fields = parseCSVLine(line);
		if (fields.length < 15) continue;

		const firstName = fields[1] || '';
		const lastName = fields[2] || '';
		const email = fields[3] || '';
		const phone = fields[4] || '';
		const eventName = fields[5] || '';
		const eventDateStr = fields[7] || '';
		const qty = parseInt(fields[8]) || 0;
		const discountCode = fields[9] || '';
		const discountValue = parseFloat(fields[10]) || 0;
		const dateCreated = fields[12] || '';
		const itemTotal = parseFloat(fields[14]) || 0;

		if (!eventName) continue;

		let showDate = null;
		if (eventDateStr) {
			const match = eventDateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
			if (match) {
				showDate = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
			}
		}

		let purchaseDate = null;
		if (dateCreated) {
			const match = dateCreated.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
			if (match) {
				purchaseDate = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
			}
		}

		eventNamesSet.add(eventName);
		if (discountCode) {
			discountCodesSet.add(discountCode);
		}

		rows.push({
			firstName,
			lastName,
			email,
			phone,
			eventName,
			showDate,
			qty,
			purchaseDate,
			itemTotal,
			discountCode,
			discountValue
		});
	}

	return {
		rows,
		eventNames: [...eventNamesSet].sort(),
		discountCodes: [...discountCodesSet].sort()
	};
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