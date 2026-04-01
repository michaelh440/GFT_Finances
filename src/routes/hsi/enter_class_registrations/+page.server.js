// src/routes/hsi/enter_class_registrations/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
  requirePermission(locals.user, 'hsi', 'data_entry');
  try {
    const classes = await sql`
      SELECT class_code, class_name, track, standard_price
      FROM classes
      WHERE is_active = true
      ORDER BY track ASC, class_name ASC
    `;

    return {
      classes: classes.map(c => ({
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
  manual: async ({ request, locals }) => {
    requirePermission(locals.user, 'hsi', 'data_entry');
    const formData = await request.formData();
    const rowCount = parseInt((formData.get('row_count') || '').toString()) || 0;

    if (rowCount === 0) {
      return { success: false, error: 'No data to save.' };
    }

    let saved = 0;
    let skipped = 0;
    let newStudents = 0;
    const results = [];

    try {
      for (let i = 0; i < rowCount; i++) {
        const firstName = (formData.get(`first_name_${i}`) || '').toString().trim();
        const lastName = (formData.get(`last_name_${i}`) || '').toString().trim();
        const email = (formData.get(`email_${i}`) || '').toString().trim().toLowerCase();
        const phone = (formData.get(`phone_${i}`) || '').toString().trim();
        const classCode = (formData.get(`class_code_${i}`) || '').toString();
        const classDate = (formData.get(`class_date_${i}`) || '').toString();
        const registrationDate = (formData.get(`registration_date_${i}`) || '').toString();
        const amountPaid = parseFloat((formData.get(`amount_paid_${i}`) || '').toString()) || 0;

        if (!email || !classCode || !classDate) {
          skipped++;
          continue;
        }

        const studentId = await findOrCreateStudent(email, firstName, lastName, phone, null, null);
        if (studentId.created) newStudents++;

        await sql`
          INSERT INTO registrations (student_id, class_code, class_date, registration_date, amount_paid)
          VALUES (${studentId.id}, ${classCode}, ${classDate}, ${registrationDate || classDate}, ${amountPaid})
        `;

        results.push({ name: `${firstName} ${lastName}`, email, status: studentId.created ? 'new student' : 'existing' });
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
      return { success: false, error: 'Failed to save registrations: ' + (error instanceof Error ? error.message : String(error)) };
    }
  },

  // CSV Step 1: Check for matches and session
  csv_check: async ({ request, locals }) => {
    requirePermission(locals.user, 'hsi', 'data_entry');
    const formData = await request.formData();
    const csvData = (formData.get('csv_data') || '').toString();
    const classCode = (formData.get('csv_class_code') || '').toString();
    const classDate = (formData.get('csv_class_date') || '').toString();
    const classTime = (formData.get('csv_class_time') || '').toString().trim() || null;

    if (!csvData || !classCode || !classDate) {
      return { success: false, error: 'CSV data, class, and class date are required.' };
    }

    try {
      // Check if a session already exists for this class + start_date + start_time
      const timeFilter = classTime
        ? sql`AND cs.start_time = ${classTime}`
        : sql`AND cs.start_time IS NULL`;

      const existingSession = await sql`
        SELECT cs.session_id, cs.session_name, cs.start_date, cs.end_date,
          cs.start_time, cs.end_time,
          COALESCE(t.first_name || ' ' || t.last_name, cs.instructor) AS instructor,
          cs.location, cs.price
        FROM class_sessions cs
        LEFT JOIN teachers t ON cs.teacher_id = t.teacher_id
        WHERE cs.class_code = ${classCode}
          AND cs.start_date = ${classDate}
          ${timeFilter}
        LIMIT 1
      `;

      let sessionInfo = null;
      if (existingSession.length > 0) {
        const es = existingSession[0];
        sessionInfo = {
          session_id: es.session_id,
          session_name: es.session_name,
          start_date: es.start_date?.toISOString().split('T')[0],
          end_date: es.end_date?.toISOString().split('T')[0],
          start_time: es.start_time || null,
          end_time: es.end_time || null,
          instructor: es.instructor,
          location: es.location,
          price: Number(es.price || 0),
          exists: true
        };
      }

      // Check student matches
      /** @type {any[]} */
      const rows = JSON.parse(csvData);
      /** @type {any[]} */
      const matchResults = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = (row.email || '').trim().toLowerCase();
        const firstName = (row.first_name || '').trim();
        const lastName = (row.last_name || '').trim();
        const phone = (row.phone || '').trim();
        const mobilePhone = (row.mobile_phone || '').trim();
        const acctId = (row.acct_id || '').trim();
        const amountPaid = parseFloat(row.amount_paid) || 0;
        const registrationDate = row.registration_date || classDate;
        const isGuest = row.is_guest || false;

        // Guests without email are always new — skip empty non-guests
        if (!email && !isGuest) continue;

        let matchType = 'new';
        let dbStudent = null;
        let dbRegistration = null;

        // 1. Try AcctID match first (definitive)
        if (acctId) {
          const acctMatch = await sql`
            SELECT student_id, first_name, last_name, email, phone, mobile_phone, account_date, vbo_account_id,
                   address_line1, city, state, zip_code
            FROM students
            WHERE vbo_account_id = ${acctId}
            LIMIT 1
          `;
          if (acctMatch.length > 0) {
            dbStudent = {
              student_id: acctMatch[0].student_id,
              first_name: acctMatch[0].first_name,
              last_name: acctMatch[0].last_name,
              email: acctMatch[0].email,
              phone: acctMatch[0].phone || '',
              mobile_phone: acctMatch[0].mobile_phone || '',
              vbo_account_id: acctMatch[0].vbo_account_id || '',
              account_date: acctMatch[0].account_date
                ? acctMatch[0].account_date.toISOString().split('T')[0]
                : null,
              address_line1: acctMatch[0].address_line1 || '',
              city: acctMatch[0].city || '',
              state: acctMatch[0].state || '',
              zip_code: acctMatch[0].zip_code || ''
            };
            matchType = 'acctid_match';
          }
        }

        // 2. Try email match if no AcctID match
        if (!dbStudent && email) {
          const studentMatch = await sql`
            SELECT student_id, first_name, last_name, email, phone, mobile_phone, account_date, vbo_account_id,
                   address_line1, city, state, zip_code
            FROM students
            WHERE LOWER(TRIM(email)) = ${email}
            LIMIT 1
          `;

          if (studentMatch.length > 0) {
            dbStudent = {
              student_id: studentMatch[0].student_id,
              first_name: studentMatch[0].first_name,
              last_name: studentMatch[0].last_name,
              email: studentMatch[0].email,
              phone: studentMatch[0].phone || '',
              mobile_phone: studentMatch[0].mobile_phone || '',
              vbo_account_id: studentMatch[0].vbo_account_id || '',
              account_date: studentMatch[0].account_date
                ? studentMatch[0].account_date.toISOString().split('T')[0]
                : null,
              address_line1: studentMatch[0].address_line1 || '',
              city: studentMatch[0].city || '',
              state: studentMatch[0].state || '',
              zip_code: studentMatch[0].zip_code || ''
            };
            matchType = 'email_match';
          }
        }

        // 3. Try name match as fallback
        if (!dbStudent && firstName && lastName) {
          const nameMatch = await sql`
            SELECT student_id, first_name, last_name, email, phone, mobile_phone, account_date, vbo_account_id,
                   address_line1, city, state, zip_code
            FROM students
            WHERE LOWER(TRIM(first_name)) = ${firstName.toLowerCase()}
              AND LOWER(TRIM(last_name)) = ${lastName.toLowerCase()}
            LIMIT 1
          `;

          if (nameMatch.length > 0) {
            dbStudent = {
              student_id: nameMatch[0].student_id,
              first_name: nameMatch[0].first_name,
              last_name: nameMatch[0].last_name,
              email: nameMatch[0].email,
              phone: nameMatch[0].phone || '',
              mobile_phone: nameMatch[0].mobile_phone || '',
              vbo_account_id: nameMatch[0].vbo_account_id || '',
              account_date: nameMatch[0].account_date
                ? nameMatch[0].account_date.toISOString().split('T')[0]
                : null,
              address_line1: nameMatch[0].address_line1 || '',
              city: nameMatch[0].city || '',
              state: nameMatch[0].state || '',
              zip_code: nameMatch[0].zip_code || ''
            };
            matchType = 'name_match';
          }
        }

        // Check for existing registration if student found
        if (dbStudent) {
          const regMatch = await sql`
            SELECT registration_id, class_code, class_date, registration_date, amount_paid, session_id
            FROM registrations
            WHERE student_id = ${dbStudent.student_id}
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
          } else if (matchType === 'email_match' || matchType === 'acctid_match') {
            matchType = 'existing_no_reg';
          } else {
            // name_match without registration — still show as potential match
            matchType = 'existing_no_reg';
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
            mobile_phone: mobilePhone,
            acct_id: acctId,
            amount_paid: amountPaid,
            registration_date: registrationDate,
            is_guest: isGuest,
            address_line1: row.address_line1 || '',
            address_line2: row.address_line2 || '',
            city: row.city || '',
            state: row.state || '',
            zip_code: row.zip_code || '',
            country: row.country || ''
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
      return { success: false, error: 'Failed to check CSV: ' + (error instanceof Error ? error.message : String(error)) };
    }
  },

  // CSV Step 2: Confirm and save with user decisions
  csv_confirm: async ({ request, locals }) => {
    requirePermission(locals.user, 'hsi', 'data_entry');
    const formData = await request.formData();
    const decisionsJson = (formData.get('decisions') || '').toString();
    const classCode = (formData.get('csv_class_code') || '').toString();
    const classDate = (formData.get('csv_class_date') || '').toString();
    const classTime = (formData.get('csv_class_time') || '').toString().trim() || null;
    const sessionName = (formData.get('session_name') || '').toString();
    const existingSessionId = (formData.get('existing_session_id') || '').toString();

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
          INSERT INTO class_sessions (class_code, session_name, start_date, start_time, price)
          VALUES (${classCode}, ${finalName}, ${classDate}, ${classTime}, ${defaultPrice})
          RETURNING session_id
        `;
        sessionId = newSession[0].session_id;
      }

      /** @type {any[]} */
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
          const studentEmail = csv.email || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@placeholder.local`;

          const newStudent = await sql`
            INSERT INTO students (first_name, last_name, email, phone, mobile_phone, account_date,
              vbo_account_id, address_line1, address_line2, city, state, zip_code, country)
            VALUES (${csv.first_name}, ${csv.last_name}, ${studentEmail}, ${csv.phone || null}, ${csv.mobile_phone || null}, CURRENT_DATE,
              ${csv.acct_id || null}, ${csv.address_line1 || null}, ${csv.address_line2 || null},
              ${csv.city || null}, ${csv.state || null}, ${csv.zip_code || null}, ${csv.country || null})
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
              } else if (field === 'phone' && csv.phone) {
                await sql`UPDATE students SET phone = ${csv.phone}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
              }
            }
          }

          // Fill in AcctID, phone, and address if empty
          await sql`
            UPDATE students SET
              vbo_account_id = CASE WHEN (vbo_account_id IS NULL OR vbo_account_id = '') AND ${csv.acct_id || ''} != '' THEN ${csv.acct_id} ELSE vbo_account_id END,
              phone = CASE WHEN (phone IS NULL OR phone = '') AND ${csv.phone || ''} != '' THEN ${csv.phone} ELSE phone END,
              mobile_phone = CASE WHEN (mobile_phone IS NULL OR mobile_phone = '') AND ${csv.mobile_phone || ''} != '' THEN ${csv.mobile_phone} ELSE mobile_phone END,
              address_line1 = CASE WHEN (address_line1 IS NULL OR address_line1 = '') AND ${csv.address_line1 || ''} != '' THEN ${csv.address_line1} ELSE address_line1 END,
              address_line2 = CASE WHEN (address_line2 IS NULL OR address_line2 = '') AND ${csv.address_line2 || ''} != '' THEN ${csv.address_line2} ELSE address_line2 END,
              city = CASE WHEN (city IS NULL OR city = '') AND ${csv.city || ''} != '' THEN ${csv.city} ELSE city END,
              state = CASE WHEN (state IS NULL OR state = '') AND ${csv.state || ''} != '' THEN ${csv.state} ELSE state END,
              zip_code = CASE WHEN (zip_code IS NULL OR zip_code = '') AND ${csv.zip_code || ''} != '' THEN ${csv.zip_code} ELSE zip_code END,
              country = CASE WHEN (country IS NULL OR country = '') AND ${csv.country || ''} != '' THEN ${csv.country} ELSE country END,
              updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${studentId}
          `;

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
              } else if (field === 'phone' && csv.phone) {
                await sql`UPDATE students SET phone = ${csv.phone}, updated_at = CURRENT_TIMESTAMP WHERE student_id = ${studentId}`;
              }
            }
          }

          // Fill in AcctID, phone, and address if empty
          await sql`
            UPDATE students SET
              vbo_account_id = CASE WHEN (vbo_account_id IS NULL OR vbo_account_id = '') AND ${csv.acct_id || ''} != '' THEN ${csv.acct_id} ELSE vbo_account_id END,
              phone = CASE WHEN (phone IS NULL OR phone = '') AND ${csv.phone || ''} != '' THEN ${csv.phone} ELSE phone END,
              mobile_phone = CASE WHEN (mobile_phone IS NULL OR mobile_phone = '') AND ${csv.mobile_phone || ''} != '' THEN ${csv.mobile_phone} ELSE mobile_phone END,
              address_line1 = CASE WHEN (address_line1 IS NULL OR address_line1 = '') AND ${csv.address_line1 || ''} != '' THEN ${csv.address_line1} ELSE address_line1 END,
              address_line2 = CASE WHEN (address_line2 IS NULL OR address_line2 = '') AND ${csv.address_line2 || ''} != '' THEN ${csv.address_line2} ELSE address_line2 END,
              city = CASE WHEN (city IS NULL OR city = '') AND ${csv.city || ''} != '' THEN ${csv.city} ELSE city END,
              state = CASE WHEN (state IS NULL OR state = '') AND ${csv.state || ''} != '' THEN ${csv.state} ELSE state END,
              zip_code = CASE WHEN (zip_code IS NULL OR zip_code = '') AND ${csv.zip_code || ''} != '' THEN ${csv.zip_code} ELSE zip_code END,
              country = CASE WHEN (country IS NULL OR country = '') AND ${csv.country || ''} != '' THEN ${csv.country} ELSE country END,
              updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${studentId}
          `;

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
      if (newStudents > 0) parts.push(`${newStudents} new student${newStudents !== 1 ? 's' : ''} created`);
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
      return { success: false, error: 'Failed to save: ' + (error instanceof Error ? error.message : String(error)) };
    }
  }
};

/**
 * @param {string} email
 * @param {string} firstName
 * @param {string} lastName
 * @param {string|null} phone
 * @param {string|null} acctId
 * @param {any} addressData
 */
async function findOrCreateStudent(email, firstName, lastName, phone, acctId, addressData) {
  // 1. Try AcctID match first
  if (acctId) {
    const acctMatch = await sql`
      SELECT student_id FROM students WHERE vbo_account_id = ${acctId} LIMIT 1
    `;
    if (acctMatch.length > 0) {
      return { id: acctMatch[0].student_id, created: false };
    }
  }

  // 2. Try exact name+email match
  const existing = await sql`
    SELECT student_id FROM students
    WHERE LOWER(TRIM(email)) = ${email.toLowerCase()}
      AND LOWER(TRIM(first_name)) = ${firstName.toLowerCase()}
      AND LOWER(TRIM(last_name)) = ${lastName.toLowerCase()}
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Fill in missing data
    await sql`
      UPDATE students SET
        phone = COALESCE(NULLIF(phone, ''), ${phone || null}),
        vbo_account_id = CASE WHEN (vbo_account_id IS NULL OR vbo_account_id = '') AND ${acctId || ''} != '' THEN ${acctId} ELSE vbo_account_id END,
        updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${existing[0].student_id}
    `;
    return { id: existing[0].student_id, created: false };
  }

  // 3. Try email-only match
  const emailMatch = await sql`
    SELECT student_id FROM students WHERE LOWER(TRIM(email)) = ${email.toLowerCase()} LIMIT 1
  `;

  if (emailMatch.length > 0) {
    return { id: emailMatch[0].student_id, created: false };
  }

  // 4. Try name-only match
  const nameMatch = await sql`
    SELECT student_id FROM students
    WHERE LOWER(TRIM(first_name)) = ${firstName.toLowerCase()}
      AND LOWER(TRIM(last_name)) = ${lastName.toLowerCase()}
    LIMIT 1
  `;

  if (nameMatch.length > 0) {
    return { id: nameMatch[0].student_id, created: false };
  }

  // 5. Create new — with safe insert
  try {
    const addr = addressData || {};
    const newStudent = await sql`
      INSERT INTO students (first_name, last_name, email, phone, mobile_phone, account_date,
        vbo_account_id, address_line1, address_line2, city, state, zip_code, country)
      VALUES (${firstName}, ${lastName}, ${email}, ${phone || null}, ${addr.mobile_phone || null}, CURRENT_DATE,
        ${acctId || null}, ${addr.address_line1 || null}, ${addr.address_line2 || null},
        ${addr.city || null}, ${addr.state || null}, ${addr.zip_code || null}, ${addr.country || null})
      RETURNING student_id
    `;
    return { id: newStudent[0].student_id, created: true };
  } catch (err) {
    if (/** @type {any} */ (err).code === '23505') {
      // Unique constraint — find and return existing
      const fallback = await sql`
        SELECT student_id FROM students
        WHERE LOWER(TRIM(email)) = ${email.toLowerCase()}
        LIMIT 1
      `;
      if (fallback.length > 0) return { id: fallback[0].student_id, created: false };
    }
    throw err;
  }
}