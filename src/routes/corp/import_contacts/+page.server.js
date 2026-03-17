// src/routes/corp/import_contacts/+page.server.js
import sql from '$lib/db';

export const load = async () => {
  return {};
};

export const actions = {
  // Step 1: Parse CSV and check for existing contacts
  csv_check: async ({ request }) => {
    const formData = await request.formData();
    const csvData = (formData.get('csv_data') || '').toString();

    if (!csvData) {
      return { success: false, error: 'No CSV data provided.' };
    }

    try {
      /** @type {any[]} */
      const rows = JSON.parse(csvData);
      /** @type {any[]} */
      const matchResults = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = (row.email || '').trim().toLowerCase();
        const companyName = (row.company_name || '').trim();
        const firstName = (row.first_name || '').trim();
        const lastName = (row.last_name || '').trim();

        if (!email && !companyName) continue;

        let matchType = 'new';
        let dbContact = null;

        // 1. Try email match
        if (email) {
          const emailMatch = await sql`
            SELECT corp_contact_id, company_name, first_name, last_name,
                   email, phone, city, state
            FROM corp_contacts
            WHERE LOWER(TRIM(email)) = ${email}
            LIMIT 1
          `;
          if (emailMatch.length > 0) {
            dbContact = emailMatch[0];
            matchType = 'email_match';
          }
        }

        // 2. Try company name match if no email match
        if (!dbContact && companyName) {
          const coMatch = await sql`
            SELECT corp_contact_id, company_name, first_name, last_name,
                   email, phone, city, state
            FROM corp_contacts
            WHERE LOWER(TRIM(company_name)) = ${companyName.toLowerCase()}
            LIMIT 1
          `;
          if (coMatch.length > 0) {
            dbContact = coMatch[0];
            matchType = 'company_match';
          }
        }

        matchResults.push({
          index: i,
          matchType,
          csv: {
            company_name: companyName,
            first_name: firstName,
            last_name: lastName,
            email,
            phone: (row.phone || '').trim(),
            address_line1: (row.address_line1 || '').trim(),
            address_line2: (row.address_line2 || '').trim(),
            city: (row.city || '').trim(),
            state: (row.state || '').trim(),
            zip: (row.zip || '').trim(),
            country: (row.country || '').trim(),
          },
          dbContact,
        });
      }

      return {
        success: true,
        action: 'csv_check',
        matchResults,
        csvData,
      };
    } catch (err) {
      console.error('csv_check error:', err);
      return { success: false, error: 'Failed to check CSV: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },

  // Step 2: Confirm and write to DB
  csv_confirm: async ({ request }) => {
    const formData = await request.formData();
    const decisionsJson = (formData.get('decisions') || '').toString();

    if (!decisionsJson) {
      return { success: false, error: 'Missing decisions data.' };
    }

    try {
      /** @type {any[]} */
      const decisions = JSON.parse(decisionsJson);
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const d of decisions) {
        if (d.action === 'skip') { skipped++; continue; }

        const csv = d.csv;

        if (d.action === 'create') {
          await sql`
            INSERT INTO corp_contacts
              (company_name, first_name, last_name, email, phone,
               address_line1, address_line2, city, state, zip, country)
            VALUES
              (${csv.company_name || null}, ${csv.first_name || null}, ${csv.last_name || null},
               ${csv.email || null}, ${csv.phone || null},
               ${csv.address_line1 || null}, ${csv.address_line2 || null},
               ${csv.city || null}, ${csv.state || null}, ${csv.zip || null}, ${csv.country || null})
          `;
          created++;
        } else if (d.action === 'update') {
          const id = d.corp_contact_id;
          const fields = d.updateFields || [];

          for (const field of fields) {
            if (field === 'company_name')  await sql`UPDATE corp_contacts SET company_name  = ${csv.company_name},  updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'first_name')    await sql`UPDATE corp_contacts SET first_name    = ${csv.first_name},    updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'last_name')     await sql`UPDATE corp_contacts SET last_name     = ${csv.last_name},     updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'phone')         await sql`UPDATE corp_contacts SET phone         = ${csv.phone},         updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'city')          await sql`UPDATE corp_contacts SET city          = ${csv.city},          updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'state')         await sql`UPDATE corp_contacts SET state         = ${csv.state},         updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'address_line1') await sql`UPDATE corp_contacts SET address_line1 = ${csv.address_line1}, updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'zip')           await sql`UPDATE corp_contacts SET zip           = ${csv.zip},           updated_at = NOW() WHERE corp_contact_id = ${id}`;
          }

          // Always fill in blanks from CSV without overwriting existing data
          await sql`
            UPDATE corp_contacts SET
              address_line1 = CASE WHEN (address_line1 IS NULL OR address_line1 = '') AND ${csv.address_line1 || ''} != '' THEN ${csv.address_line1} ELSE address_line1 END,
              address_line2 = CASE WHEN (address_line2 IS NULL OR address_line2 = '') AND ${csv.address_line2 || ''} != '' THEN ${csv.address_line2} ELSE address_line2 END,
              city          = CASE WHEN (city IS NULL OR city = '')                   AND ${csv.city || ''} != ''          THEN ${csv.city}          ELSE city          END,
              state         = CASE WHEN (state IS NULL OR state = '')                 AND ${csv.state || ''} != ''         THEN ${csv.state}         ELSE state         END,
              zip           = CASE WHEN (zip IS NULL OR zip = '')                     AND ${csv.zip || ''} != ''           THEN ${csv.zip}           ELSE zip           END,
              country       = CASE WHEN (country IS NULL OR country = '')             AND ${csv.country || ''} != ''       THEN ${csv.country}       ELSE country       END,
              updated_at    = NOW()
            WHERE corp_contact_id = ${id}
          `;
          updated++;
        }
      }

      const parts = [];
      if (created) parts.push(`${created} contact${created !== 1 ? 's' : ''} created`);
      if (updated) parts.push(`${updated} updated`);
      if (skipped) parts.push(`${skipped} skipped`);

      return { success: true, action: 'csv_confirm', message: parts.join(', ') + '.' };
    } catch (err) {
      console.error('csv_confirm error:', err);
      return { success: false, error: 'Failed to save: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },
};