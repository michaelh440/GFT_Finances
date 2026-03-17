// src/routes/corp/import/+page.server.js
import sql from '$lib/db';

export const load = async () => ({ });

export const actions = {

  // ── Step 1: Parse CSV server-side, deduplicate contacts, check DB matches ──
  csv_check: async ({ request }) => {
    const formData = await request.formData();
    const csvData  = (formData.get('csv_data') || '').toString();
    if (!csvData) return { success: false, error: 'No CSV data provided.' };

    try {
      /** @type {any[]} */
      const rows = JSON.parse(csvData);

      // ── Deduplicate contacts by email (then company name) ─────────────────
      /** @type {Map<string, any>} */
      const contactsByEmail   = new Map();
      /** @type {Map<string, any>} */
      const contactsByCompany = new Map();
      /** @type {any[]} */
      const uniqueContacts    = [];

      for (const row of rows) {
        const emailKey   = (row.email        || '').trim().toLowerCase();
        const companyKey = (row.company_name || '').trim().toLowerCase();

        if (emailKey && contactsByEmail.has(emailKey)) continue;
        if (!emailKey && companyKey && contactsByCompany.has(companyKey)) continue;

        const contact = {
          company_name:  row.company_name  || null,
          first_name:    row.first_name    || null,
          last_name:     row.last_name     || null,
          email:         row.email         || null,
          phone:         row.phone         || null,
          address_line1: row.address_line1 || null,
          address_line2: row.address_line2 || null,
          city:          row.city          || null,
          state:         row.state         || null,
          zip:           row.zip           || null,
          country:       row.country       || null,
        };

        uniqueContacts.push(contact);
        if (emailKey)   contactsByEmail.set(emailKey, contact);
        if (companyKey) contactsByCompany.set(companyKey, contact);
      }

      // ── Check each unique contact against DB ──────────────────────────────
      /** @type {any[]} */
      const contactMatches = [];
      for (const c of uniqueContacts) {
        const email      = (c.email        || '').trim().toLowerCase();
        const companyRaw = (c.company_name || '').trim();
        let dbContact    = null;
        let matchType    = 'new';

        if (email) {
          const res = await sql`
            SELECT corp_contact_id, company_name, first_name, last_name, email, phone, city, state
            FROM corp_contacts WHERE LOWER(TRIM(email)) = ${email} LIMIT 1
          `;
          if (res.length) { dbContact = res[0]; matchType = 'email_match'; }
        }
        if (!dbContact && companyRaw) {
          const res = await sql`
            SELECT corp_contact_id, company_name, first_name, last_name, email, phone, city, state
            FROM corp_contacts WHERE LOWER(TRIM(company_name)) = ${companyRaw.toLowerCase()} LIMIT 1
          `;
          if (res.length) { dbContact = res[0]; matchType = 'company_match'; }
        }

        contactMatches.push({ csv: c, matchType, dbContact });
      }

      // ── Build engagement list (one per CSV row, linked to contact index) ──
      /** @type {any[]} */
      const engagements = [];
      for (const row of rows) {
        const emailKey   = (row.email        || '').trim().toLowerCase();
        const companyKey = (row.company_name || '').trim().toLowerCase();

        // Find which contact this row maps to (by index in uniqueContacts)
        let contactIdx = -1;
        if (emailKey) {
          contactIdx = uniqueContacts.findIndex(c =>
            (c.email || '').trim().toLowerCase() === emailKey
          );
        }
        if (contactIdx === -1 && companyKey) {
          contactIdx = uniqueContacts.findIndex(c =>
            (c.company_name || '').trim().toLowerCase() === companyKey
          );
        }

        engagements.push({
          contactIdx,                    // index into contactMatches
          title:            row.title            || null,
          engagement_type:  row.engagement_type  || 'other',
          pipeline_status:  row.pipeline_status  || 'none',
          contract_status:  row.contract_status  || null,
          engagement_date:  row.engagement_date  || null,
          end_date:         row.end_date         || null,
          audience_size_min:    row.audience_size_min    ? parseInt(row.audience_size_min)    : null,
          audience_size_max:    row.audience_size_max    ? parseInt(row.audience_size_max)    : null,
          audience_size_approx: row.audience_size_approx === true || row.audience_size_approx === 'true',
          amount_paid:      row.amount_paid != null && row.amount_paid !== '' ? parseFloat(row.amount_paid) : null,
          notes:            row.notes            || null,
          is_archived:      row.is_archived === true || row.is_archived === 'true' || row.is_archived === '1',
          dubsado_project_title: row.dubsado_project_title || row.title || null,
        });
      }

      return {
        success: true,
        action: 'csv_check',
        contactMatches,
        engagements,
      };

    } catch (err) {
      console.error('csv_check error:', err);
      return { success: false, error: 'Check failed: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },

  // ── Step 2: Write contacts first, then engagements with real IDs ──────────
  csv_confirm: async ({ request }) => {
    const formData          = await request.formData();
    const contactDecisionsJson = (formData.get('contact_decisions') || '').toString();
    const engagementDecisionsJson = (formData.get('engagement_decisions') || '').toString();

    if (!contactDecisionsJson || !engagementDecisionsJson) {
      return { success: false, error: 'Missing decisions data.' };
    }

    try {
      /** @type {any[]} */
      const contactDecisions    = JSON.parse(contactDecisionsJson);
      /** @type {any[]} */
      const engagementDecisions = JSON.parse(engagementDecisionsJson);

      let contactsCreated = 0;
      let contactsUpdated = 0;
      let contactsSkipped = 0;
      let engsCreated     = 0;
      let engsSkipped     = 0;

      // Map: contactIdx → resolved corp_contact_id (from DB)
      /** @type {Map<number, number|null>} */
      const contactIdMap = new Map();

      // ── 1. Insert / update contacts ───────────────────────────────────────
      for (const d of contactDecisions) {
        const { idx, action, csv, corp_contact_id } = d;

        if (action === 'skip') {
          // Still need to record the existing ID so engagements can link
          contactIdMap.set(idx, corp_contact_id ?? null);
          contactsSkipped++;
          continue;
        }

        const c = csv;

        if (action === 'create') {
          const res = await sql`
            INSERT INTO corp_contacts
              (company_name, first_name, last_name, email, phone,
               address_line1, address_line2, city, state, zip, country)
            VALUES
              (${c.company_name || null}, ${c.first_name || null}, ${c.last_name || null},
               ${c.email        || null}, ${c.phone      || null},
               ${c.address_line1 || null}, ${c.address_line2 || null},
               ${c.city || null}, ${c.state || null}, ${c.zip || null}, ${c.country || null})
            RETURNING corp_contact_id
          `;
          contactIdMap.set(idx, res[0].corp_contact_id);
          contactsCreated++;

        } else if (action === 'update') {
          const id     = corp_contact_id;
          const fields = d.updateFields || [];

          for (const field of fields) {
            if (field === 'company_name')  await sql`UPDATE corp_contacts SET company_name  = ${c.company_name},  updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'first_name')    await sql`UPDATE corp_contacts SET first_name    = ${c.first_name},    updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'last_name')     await sql`UPDATE corp_contacts SET last_name     = ${c.last_name},     updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'phone')         await sql`UPDATE corp_contacts SET phone         = ${c.phone},         updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'city')          await sql`UPDATE corp_contacts SET city          = ${c.city},          updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'state')         await sql`UPDATE corp_contacts SET state         = ${c.state},         updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'address_line1') await sql`UPDATE corp_contacts SET address_line1 = ${c.address_line1}, updated_at = NOW() WHERE corp_contact_id = ${id}`;
            if (field === 'zip')           await sql`UPDATE corp_contacts SET zip           = ${c.zip},           updated_at = NOW() WHERE corp_contact_id = ${id}`;
          }

          // Fill blanks silently
          await sql`
            UPDATE corp_contacts SET
              address_line1 = CASE WHEN (address_line1 IS NULL OR address_line1 = '') AND ${c.address_line1 || ''} != '' THEN ${c.address_line1} ELSE address_line1 END,
              city          = CASE WHEN (city IS NULL OR city = '') AND ${c.city || ''} != '' THEN ${c.city} ELSE city END,
              state         = CASE WHEN (state IS NULL OR state = '') AND ${c.state || ''} != '' THEN ${c.state} ELSE state END,
              zip           = CASE WHEN (zip IS NULL OR zip = '') AND ${c.zip || ''} != '' THEN ${c.zip} ELSE zip END,
              country       = CASE WHEN (country IS NULL OR country = '') AND ${c.country || ''} != '' THEN ${c.country} ELSE country END,
              updated_at    = NOW()
            WHERE corp_contact_id = ${id}
          `;
          contactIdMap.set(idx, id);
          contactsUpdated++;
        }
      }

      // ── 2. Insert engagements using resolved contact IDs ──────────────────
      for (const d of engagementDecisions) {
        if (d.action === 'skip') { engsSkipped++; continue; }

        const e          = d.engagement;
        const contactId  = contactIdMap.get(e.contactIdx) ?? null;

        await sql`
          INSERT INTO corp_engagements
            (corp_contact_id, title, dubsado_project_title, engagement_type,
             pipeline_status, contract_status,
             engagement_date, end_date,
             audience_size_min, audience_size_max, audience_size_approx,
             amount_paid, notes, is_archived)
          VALUES
            (${contactId},
             ${e.title || null}, ${e.dubsado_project_title || e.title || null},
             ${e.engagement_type || 'other'},
             ${e.pipeline_status || 'none'},
             ${e.contract_status || null},
             ${e.engagement_date || null}, ${e.end_date || null},
             ${e.audience_size_min ?? null}, ${e.audience_size_max ?? null}, ${e.audience_size_approx ?? false},
             ${e.amount_paid ?? null}, ${e.notes || null}, ${e.is_archived ?? false})
        `;
        engsCreated++;
      }

      const parts = [];
      if (contactsCreated) parts.push(`${contactsCreated} contact${contactsCreated !== 1 ? 's' : ''} created`);
      if (contactsUpdated) parts.push(`${contactsUpdated} updated`);
      if (contactsSkipped) parts.push(`${contactsSkipped} skipped`);
      parts.push(`${engsCreated} engagement${engsCreated !== 1 ? 's' : ''} imported`);
      if (engsSkipped) parts.push(`${engsSkipped} engagements skipped`);

      return { success: true, action: 'csv_confirm', message: parts.join(', ') + '.' };

    } catch (err) {
      console.error('csv_confirm error:', err);
      return { success: false, error: 'Import failed: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },

  // ── Reset sequence ────────────────────────────────────────────────────────
  reset_sequence: async () => {
    try {
      await sql`
        ALTER SEQUENCE corp_contacts_corp_contact_id_seq RESTART WITH 1
      `;
      // Also reset any existing rows so they don't conflict
      // (only safe if table is empty — check first)
      const count = await sql`SELECT COUNT(*) AS n FROM corp_contacts`;
      if (parseInt(count[0].n) === 0) {
        return { success: true, message: 'Sequence reset to 1. Table is empty — safe to import.' };
      }
      return {
        success: true,
        message: `Sequence reset to 1. Note: table has ${count[0].n} existing rows — next insert will conflict unless you clear the table first.`
      };
    } catch (err) {
      return { success: false, error: 'Reset failed: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },
};