// src/routes/hsi/update_student_phones/+page.server.js
import sql from '$lib/db';

export const load = async () => {
  return {};
};

export const actions = {
  // Step 1: Parse CSV and match students
  csv_check: async ({ request }) => {
    const formData = await request.formData();
    const csvData = formData.get('csv_data');

    if (!csvData) {
      return { success: false, error: 'CSV data is required.' };
    }

    try {
      const rows = JSON.parse(csvData);
      const matchResults = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = (row.email || '').trim().toLowerCase();
        const firstName = (row.first_name || '').trim();
        const lastName = (row.last_name || '').trim();
        const csvPhone = (row.phone || '').trim();
        const csvMobile = (row.mobile_phone || '').trim();
        const acctId = (row.acct_id || '').trim();

        if (!email && !acctId && (!firstName || !lastName)) continue;
        if (!csvPhone && !csvMobile) continue; // No phone data to update

        let matchType = 'not_found';
        let dbStudent = null;

        // 1. Try AcctID match first (definitive)
        if (acctId) {
          const acctMatch = await sql`
            SELECT student_id, first_name, last_name, email, phone, mobile_phone, vbo_account_id
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
              vbo_account_id: acctMatch[0].vbo_account_id || ''
            };
            matchType = 'acctid_match';
          }
        }

        // 2. Try email match
        if (!dbStudent && email) {
          const emailMatch = await sql`
            SELECT student_id, first_name, last_name, email, phone, mobile_phone, vbo_account_id
            FROM students
            WHERE LOWER(TRIM(email)) = ${email}
            LIMIT 1
          `;
          if (emailMatch.length > 0) {
            dbStudent = {
              student_id: emailMatch[0].student_id,
              first_name: emailMatch[0].first_name,
              last_name: emailMatch[0].last_name,
              email: emailMatch[0].email,
              phone: emailMatch[0].phone || '',
              mobile_phone: emailMatch[0].mobile_phone || '',
              vbo_account_id: emailMatch[0].vbo_account_id || ''
            };
            matchType = 'email_match';
          }
        }

        // 3. Try name match as fallback
        if (!dbStudent && firstName && lastName) {
          const nameMatch = await sql`
            SELECT student_id, first_name, last_name, email, phone, mobile_phone, vbo_account_id
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
              vbo_account_id: nameMatch[0].vbo_account_id || ''
            };
            matchType = 'name_match';
          }
        }

        // Determine what needs updating
        let phoneDiff = false;
        let mobileDiff = false;

        if (dbStudent) {
          const normalizePhone = (p) => (p || '').replace(/[^0-9]/g, '').slice(-10);
          const dbPhoneNorm = normalizePhone(dbStudent.phone);
          const dbMobileNorm = normalizePhone(dbStudent.mobile_phone);
          const csvPhoneNorm = normalizePhone(csvPhone);
          const csvMobileNorm = normalizePhone(csvMobile);

          // Phone differs: CSV has value and it's different from DB (or DB is empty)
          phoneDiff = csvPhoneNorm.length >= 7 && csvPhoneNorm !== dbPhoneNorm;
          mobileDiff = csvMobileNorm.length >= 7 && csvMobileNorm !== dbMobileNorm;
        }

        matchResults.push({
          index: i,
          csv: { first_name: firstName, last_name: lastName, email, phone: csvPhone, mobile_phone: csvMobile, acct_id: acctId },
          matchType,
          dbStudent,
          phoneDiff,
          mobileDiff,
          hasChanges: phoneDiff || mobileDiff
        });
      }

      return {
        success: true,
        action: 'csv_check',
        matchResults
      };
    } catch (error) {
      console.error('Error checking CSV:', error);
      return { success: false, error: 'Failed to process CSV: ' + error.message };
    }
  },

  // Step 2: Apply updates
  csv_confirm: async ({ request }) => {
    const formData = await request.formData();
    const decisionsJson = formData.get('decisions');

    if (!decisionsJson) {
      return { success: false, error: 'No update decisions provided.' };
    }

    try {
      const decisions = JSON.parse(decisionsJson);
      let updatedPhone = 0;
      let updatedMobile = 0;
      let skipped = 0;

      for (const decision of decisions) {
        if (decision.action === 'skip') {
          skipped++;
          continue;
        }

        const studentId = decision.student_id;
        if (!studentId) {
          skipped++;
          continue;
        }

        if (decision.updatePhone && decision.phone) {
          await sql`
            UPDATE students SET phone = ${decision.phone}, updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${studentId}
          `;
          updatedPhone++;
        }

        if (decision.updateMobile && decision.mobile_phone) {
          await sql`
            UPDATE students SET mobile_phone = ${decision.mobile_phone}, updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${studentId}
          `;
          updatedMobile++;
        }
      }

      const parts = [];
      if (updatedPhone > 0) parts.push(`${updatedPhone} phone number${updatedPhone !== 1 ? 's' : ''} updated`);
      if (updatedMobile > 0) parts.push(`${updatedMobile} mobile number${updatedMobile !== 1 ? 's' : ''} updated`);
      if (skipped > 0) parts.push(`${skipped} skipped`);

      return {
        success: true,
        action: 'csv_confirm',
        message: parts.join(', ') + '.'
      };
    } catch (error) {
      console.error('Error applying updates:', error);
      return { success: false, error: 'Failed to update: ' + error.message };
    }
  }
};