// src/routes/hsi/enter_class_registrations/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const classes = await sql`
      SELECT class_code, class_name, track, standard_price
      FROM classes
      WHERE is_active = true
      ORDER BY track ASC, class_name ASC
    `;

		return {
			classes: classes.map((c) => ({
				...c,
				standard_price: Number(c.standard_price || 0)
			}))
		};
	} catch (error) {
		console.error('Error loading classes:', error);
		return { classes: [] };
	}
};

export const actions = {
	// Manual row entry
	manual: async ({ request }) => {
		const formData = await request.formData();
		const rowCount = parseInt(String(formData.get('row_count'))) || 0;

		if (rowCount === 0) {
			return { success: false, error: 'No data to save.' };
		}

		let saved = 0;
		let skipped = 0;
		let newStudents = 0;
		const results = [];

		try {
			for (let i = 0; i < rowCount; i++) {
				const firstName = String(formData.get(`first_name_${i}`) || '').trim();
				const lastName = String(formData.get(`last_name_${i}`) || '').trim();
				const email = String(formData.get(`email_${i}`) || '')
					.trim()
					.toLowerCase();
				const phone = String(formData.get(`phone_${i}`) || '').trim();
				const classCode = String(formData.get(`class_code_${i}`) || '');
				const classDate = String(formData.get(`class_date_${i}`) || '');
				const registrationDate = String(formData.get(`registration_date_${i}`) || '');
				const amountPaid = parseFloat(String(formData.get(`amount_paid_${i}`))) || 0;

				if (!email || !classCode || !classDate) {
					skipped++;
					continue;
				}

				const studentId = await findOrCreateStudent(email, firstName, lastName, phone);
				if (studentId.created) newStudents++;

				await sql`
          INSERT INTO registrations (student_id, class_code, class_date, registration_date, amount_paid)
          VALUES (${studentId.id}, ${classCode}, ${classDate}, ${registrationDate || classDate}, ${amountPaid})
        `;

				results.push({
					name: `${firstName} ${lastName}`,
					email,
					status: studentId.created ? 'new student' : 'existing'
				});
				saved++;
			}

			return {
				success: true,
				action: 'manual',
				message: `Saved ${saved} registration${saved !== 1 ? 's' : ''}${newStudents > 0 ? ` (${newStudents} new student${newStudents !== 1 ? 's' : ''} created)` : ''}${skipped > 0 ? `, skipped ${skipped} incomplete rows` : ''}.`,
				results
			};
		} catch (error) {
			console.error('Error saving registrations:', error);
			return {
				success: false,
				error: 'Failed to save registrations: ' + /** @type {Error} */ (error).message
			};
		}
	},

	// CSV Step 1: Check for matches and session
	csv_check: async ({ request }) => {
		const formData = await request.formData();
		const csvData = String(formData.get('csv_data') || '');
		const classCode = String(formData.get('csv_class_code') || '');
		const classDate = String(formData.get('csv_class_date') || '');

		if (!csvData || !classCode || !classDate) {
			return { success: false, error: 'CSV data, class, and class date are required.' };
		}

		try {
			// Check if a session already exists for this class + start_date
			const existingSession = await sql`
        SELECT session_id, session_name, start_date, end_date, instructor, location, price
        FROM class_sessions
        WHERE class_code = ${classCode}
          AND start_date = ${classDate}
        LIMIT 1
      `;

			let sessionInfo = null;
			if (existingSession.length > 0) {
				sessionInfo = {
					session_id: existingSession[0].session_id,
					session_name: existingSession[0].session_name,
					start_date: existingSession[0].start_date?.toISOString().split('T')[0],
					end_date: existingSession[0].end_date?.toISOString().split('T')[0],
					instructor: existingSession[0].instructor,
					location: existingSession[0].location,
					price: Number(existingSession[0].price || 0),
					exists: true
				};
			}

			// Check student matches
			const rows = JSON.parse(csvData);
			const matchResults = [];

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				const email = (row.email || '').trim().toLowerCase();
				const firstName = (row.first_name || '').trim();
				const lastName = (row.last_name || '').trim();
				const phone = (row.phone || '').trim();
				const amountPaid = parseFloat(row.amount_paid) || 0;
				const registrationDate = row.registration_date || classDate;
				const isGuest = row.is_guest || false;

				// Guests without email are always new — skip empty non-guests
				if (!email && !isGuest) continue;

				let matchType = 'new';
				let dbStudent = null;
				let dbRegistration = null;

				if (email) {
					const studentMatch = await sql`
            SELECT student_id, first_name, last_name, email, phone, account_date
            FROM students
            WHERE email = ${email}
            LIMIT 1
          `;

					if (studentMatch.length > 0) {
						dbStudent = {
							student_id: studentMatch[0].student_id,
							first_name: studentMatch[0].first_name,
							last_name: studentMatch[0].last_name,
							email: studentMatch[0].email,
							phone: studentMatch[0].phone || '',
							account_date: studentMatch[0].account_date
								? studentMatch[0].account_date.toISOString().split('T')[0]
								: null
						};

						const regMatch = await sql`
              SELECT registration_id, class_code, class_date, registration_date, amount_paid, session_id
              FROM registrations
              WHERE student_id = ${studentMatch[0].student_id}
                AND class_code = ${classCode}
              ORDER BY class_date DESC
              LIMIT 1
            `;

						if (regMatch.length > 0) {
							matchType = 'existing_with_reg';
							dbRegistration = {
								registration_id: regMatch[0].registration_id,
								class_code: regMatch[0].class_code,
								class_date: regMatch[0].class_date
									? regMatch[0].class_date.toISOString().split('T')[0]
									: null,
								registration_date: regMatch[0].registration_date
									? regMatch[0].registration_date.toISOString().split('T')[0]
									: null,
								amount_paid: Number(regMatch[0].amount_paid),
								session_id: regMatch[0].session_id
							};
						} else {
							matchType = 'existing_no_reg';
						}
					}
				}

				matchResults.push({
					index: i,
					matchType,
					csv: {
						first_name: firstName,
						last_name: lastName,
						email,
						phone,
						amount_paid: amountPaid,
						registration_date: registrationDate,
						is_guest: isGuest
					},
					dbStudent,
					dbRegistration
				});
			}

			return {
				success: true,
				action: 'csv_check',
				matchResults,
				sessionInfo,
				classCode,
				classDate,
				csvData
			};
		} catch (error) {
			console.error('Error checking CSV:', error);
			return {
				success: false,
				error: 'Failed to check CSV: ' + /** @type {Error} */ (error).message
			};
		}
	},

	// CSV Step 2: Confirm and save with user decisions
	csv_confirm: async ({ request }) => {
		const formData = await request.formData();
		const decisionsJson = String(formData.get('decisions') || '');
		const classCode = String(formData.get('csv_class_code') || '');
		const classDate = String(formData.get('csv_class_date') || '');
		const sessionName = String(formData.get('session_name') || '');
		const existingSessionId = String(formData.get('existing_session_id') || '');

		if (!decisionsJson || !classCode || !classDate) {
			return { success: false, error: 'Missing required data.' };
		}

		try {
			// Find or create session
			let sessionId;

			if (existingSessionId) {
				sessionId = parseInt(existingSessionId);
				// Optionally update session name if changed
				if (sessionName) {
					await sql`
            UPDATE class_sessions SET session_name = ${sessionName}, updated_at = CURRENT_TIMESTAMP
            WHERE session_id = ${sessionId}
          `;
				}
			} else {
				// Create new session
				const classInfo = await sql`
          SELECT class_name, standard_price FROM classes WHERE class_code = ${classCode}
        `;
				const defaultPrice = classInfo.length > 0 ? Number(classInfo[0].standard_price || 0) : 0;
				const finalName = sessionName || `${classDate} ${classCode}`;

				const newSession = await sql`
          INSERT INTO class_sessions (class_code, session_name, start_date, price)
          VALUES (${classCode}, ${finalName}, ${classDate}, ${defaultPrice})
          RETURNING session_id
        `;
				sessionId = newSession[0].session_id;
			}

			const decisions = JSON.parse(decisionsJson);
			let saved = 0;
			let updated = 0;
			let skippedCount = 0;
			let newStudents = 0;

			for (const decision of decisions) {
				if (decision.action === 'skip') {
					skippedCount++;
					continue;
				}

				const csv = decision.csv;

				if (decision.action === 'add_new') {
					// For guests without email, generate a placeholder
					const studentEmail =
						csv.email ||
						`guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@placeholder.local`;

					const newStudent = await sql`
            INSERT INTO students (first_name, last_name, email, phone, account_date)
            VALUES (${csv.first_name}, ${csv.last_name}, ${studentEmail}, ${csv.phone || null}, CURRENT_DATE)
            RETURNING student_id
          `;

					await sql`
            INSERT INTO registrations (student_id, class_code, class_date, registration_date, amount_paid, session_id)
            VALUES (${newStudent[0].student_id}, ${classCode}, ${classDate}, ${csv.registration_date || classDate}, ${csv.amount_paid}, ${sessionId})
          `;
					newStudents++;
					saved++;
				} else if (decision.action === 'add_reg') {
					const studentId = decision.student_id;

					if (decision.updateFields && decision.updateFields.length > 0) {
						for (const field of decision.updateFields) {
							if (field === 'first_name') {
								await sql`UPDATE students SET first_name = ${csv.first_name}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
							} else if (field === 'last_name') {
								await sql`UPDATE students SET last_name = ${csv.last_name}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
							} else if (field === 'phone') {
								await sql`UPDATE students SET phone = ${csv.phone}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
							}
						}
					}

					await sql`
            INSERT INTO registrations (student_id, class_code, class_date, registration_date, amount_paid, session_id)
            VALUES (${studentId}, ${classCode}, ${classDate}, ${csv.registration_date || classDate}, ${csv.amount_paid}, ${sessionId})
          `;
					saved++;
				} else if (decision.action === 'update_reg') {
					const studentId = decision.student_id;
					const registrationId = decision.registration_id;

					if (decision.updateStudentFields && decision.updateStudentFields.length > 0) {
						for (const field of decision.updateStudentFields) {
							if (field === 'first_name') {
								await sql`UPDATE students SET first_name = ${csv.first_name}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
							} else if (field === 'last_name') {
								await sql`UPDATE students SET last_name = ${csv.last_name}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
							} else if (field === 'phone') {
								await sql`UPDATE students SET phone = ${csv.phone}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
							}
						}
					}

					if (decision.updateRegFields && decision.updateRegFields.length > 0) {
						for (const field of decision.updateRegFields) {
							if (field === 'class_date') {
								await sql`UPDATE registrations SET class_date = ${classDate}, updated_at = CURRENT_TIMESTAMP WHERE registration_id = ${registrationId}`;
							} else if (field === 'amount_paid') {
								await sql`UPDATE registrations SET amount_paid = ${csv.amount_paid}, updated_at = CURRENT_TIMESTAMP WHERE registration_id = ${registrationId}`;
							} else if (field === 'registration_date') {
								await sql`UPDATE registrations SET registration_date = ${csv.registration_date}, updated_at = CURRENT_TIMESTAMP WHERE registration_id = ${registrationId}`;
							}
						}
					}

					// Also link existing registration to this session if not already linked
					await sql`
            UPDATE registrations SET session_id = ${sessionId}, updated_at = CURRENT_TIMESTAMP
            WHERE registration_id = ${registrationId} AND (session_id IS NULL OR session_id != ${sessionId})
          `;
					updated++;
				}
			}

			const parts = [];
			if (saved > 0) parts.push(`${saved} registration${saved !== 1 ? 's' : ''} added`);
			if (newStudents > 0)
				parts.push(`${newStudents} new student${newStudents !== 1 ? 's' : ''} created`);
			if (updated > 0) parts.push(`${updated} registration${updated !== 1 ? 's' : ''} updated`);
			if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
			parts.push(`session: "${sessionName || classCode}"`);

			return {
				success: true,
				action: 'csv_confirm',
				message: parts.join(', ') + '.'
			};
		} catch (error) {
			console.error('Error confirming CSV import:', error);
			return { success: false, error: 'Failed to save: ' + /** @type {Error} */ (error).message };
		}
	}
};

/**
 * @param {string} email
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} phone
 */
async function findOrCreateStudent(email, firstName, lastName, phone) {
	const existing = await sql`
    SELECT student_id FROM students
    WHERE email = ${email}
      AND LOWER(first_name) = ${firstName.toLowerCase()}
      AND LOWER(last_name) = ${lastName.toLowerCase()}
    LIMIT 1
  `;

	if (existing.length > 0) {
		if (phone) {
			await sql`
        UPDATE students SET phone = COALESCE(NULLIF(phone, ''), ${phone}), updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${existing[0].student_id}
      `;
		}
		return { id: existing[0].student_id, created: false };
	}

	const emailMatch = await sql`
    SELECT student_id FROM students WHERE email = ${email} LIMIT 1
  `;

	if (emailMatch.length > 0) {
		return { id: emailMatch[0].student_id, created: false };
	}

	const newStudent = await sql`
    INSERT INTO students (first_name, last_name, email, phone, account_date)
    VALUES (${firstName}, ${lastName}, ${email}, ${phone || null}, CURRENT_DATE)
    RETURNING student_id
  `;

	return { id: newStudent[0].student_id, created: true };
}
