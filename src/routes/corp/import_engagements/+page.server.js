// src/routes/corp/import_engagements/+page.server.js
import sql from '$lib/db';

export const load = async () => {
  // Load contacts for the review step dropdown
  const contacts = await sql`
    SELECT corp_contact_id, company_name, first_name, last_name, email
    FROM corp_contacts
    ORDER BY company_name ASC NULLS LAST
  `;
  return { contacts: contacts.map(c => ({ ...c })) };
};

export const actions = {
  // Step 1: Check CSV rows against existing engagements + match contacts
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
        const email       = (row.email || '').trim().toLowerCase();
        const companyName = (row.company_name || '').trim();
        const title       = (row.title || '').trim();
        const engDate     = (row.engagement_date || '').trim();

        let contactMatchType = 'none';
        let dbContact = null;
        let engMatchType = 'new';
        let dbEngagement = null;

        // ── Match contact ──────────────────────────────────────────────────
        if (email) {
          const em = await sql`
            SELECT corp_contact_id, company_name, first_name, last_name, email
            FROM corp_contacts WHERE LOWER(TRIM(email)) = ${email} LIMIT 1
          `;
          if (em.length > 0) { dbContact = em[0]; contactMatchType = 'email'; }
        }
        if (!dbContact && companyName) {
          const cm = await sql`
            SELECT corp_contact_id, company_name, first_name, last_name, email
            FROM corp_contacts WHERE LOWER(TRIM(company_name)) = ${companyName.toLowerCase()} LIMIT 1
          `;
          if (cm.length > 0) { dbContact = cm[0]; contactMatchType = 'company'; }
        }

        // ── Check for duplicate engagement ─────────────────────────────────
        // Match on title + date (or company + date if no title)
        if (dbContact && engDate) {
          if (title) {
            const em2 = await sql`
              SELECT corp_engagement_id, title, engagement_date::text, amount_paid,
                     pipeline_status, contract_status, engagement_type
              FROM corp_engagements
              WHERE corp_contact_id = ${dbContact.corp_contact_id}
                AND LOWER(TRIM(title)) = ${title.toLowerCase()}
                AND engagement_date = ${engDate}
              LIMIT 1
            `;
            if (em2.length > 0) {
              dbEngagement = { ...em2[0], amount_paid: em2[0].amount_paid ? parseFloat(em2[0].amount_paid) : null };
              engMatchType = 'duplicate';
            }
          }
          if (!dbEngagement) {
            // Softer check: same contact + same date
            const em3 = await sql`
              SELECT corp_engagement_id, title, engagement_date::text, amount_paid,
                     pipeline_status, contract_status, engagement_type
              FROM corp_engagements
              WHERE corp_contact_id = ${dbContact.corp_contact_id}
                AND engagement_date = ${engDate}
              LIMIT 1
            `;
            if (em3.length > 0) {
              dbEngagement = { ...em3[0], amount_paid: em3[0].amount_paid ? parseFloat(em3[0].amount_paid) : null };
              engMatchType = 'same_date';
            }
          }
        }

        matchResults.push({
          index: i,
          contactMatchType,
          engMatchType,
          csv: row,
          dbContact,
          dbEngagement,
        });
      }

      return { success: true, action: 'csv_check', matchResults };
    } catch (err) {
      console.error('csv_check error:', err);
      return { success: false, error: 'Failed to check: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },

  // Step 2: Write engagements to DB
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
      let skipped = 0;
      let updated = 0;

      for (const d of decisions) {
        if (d.action === 'skip') { skipped++; continue; }

        const csv = d.csv;
        const contactId = d.corp_contact_id ?? null;
        const audMin  = csv.audience_size_min  ? parseInt(csv.audience_size_min)  : null;
        const audMax  = csv.audience_size_max  ? parseInt(csv.audience_size_max)  : null;
        const audApprox = csv.audience_size_approx === true || csv.audience_size_approx === 'true';
        const amtPaid = csv.amount_paid != null && csv.amount_paid !== '' ? parseFloat(csv.amount_paid) : null;

        if (d.action === 'create') {
          await sql`
            INSERT INTO corp_engagements
              (corp_contact_id, title, dubsado_project_title, engagement_type,
               pipeline_status, contract_status,
               engagement_date, end_date,
               audience_size_min, audience_size_max, audience_size_approx,
               amount_paid, notes, is_archived)
            VALUES
              (${contactId},
               ${csv.title || null}, ${csv.dubsado_project_title || csv.title || null},
               ${csv.engagement_type || 'other'},
               ${csv.pipeline_status || 'none'},
               ${csv.contract_status || null},
               ${csv.engagement_date || null}, ${csv.end_date || null},
               ${audMin}, ${audMax}, ${audApprox},
               ${amtPaid}, ${csv.notes || null},
               ${csv.is_archived === true || csv.is_archived === 'true'})
          `;
          created++;
        } else if (d.action === 'update') {
          const id = d.corp_engagement_id;
          const fields = d.updateFields || [];
          for (const field of fields) {
            if (field === 'title')           await sql`UPDATE corp_engagements SET title            = ${csv.title},            updated_at = NOW() WHERE corp_engagement_id = ${id}`;
            if (field === 'engagement_type') await sql`UPDATE corp_engagements SET engagement_type  = ${csv.engagement_type},  updated_at = NOW() WHERE corp_engagement_id = ${id}`;
            if (field === 'pipeline_status') await sql`UPDATE corp_engagements SET pipeline_status  = ${csv.pipeline_status},  updated_at = NOW() WHERE corp_engagement_id = ${id}`;
            if (field === 'contract_status') await sql`UPDATE corp_engagements SET contract_status  = ${csv.contract_status},  updated_at = NOW() WHERE corp_engagement_id = ${id}`;
            if (field === 'amount_paid')     await sql`UPDATE corp_engagements SET amount_paid      = ${amtPaid},             updated_at = NOW() WHERE corp_engagement_id = ${id}`;
            if (field === 'notes')           await sql`UPDATE corp_engagements SET notes            = ${csv.notes},            updated_at = NOW() WHERE corp_engagement_id = ${id}`;
          }
          updated++;
        }
      }

      const parts = [];
      if (created) parts.push(`${created} engagement${created !== 1 ? 's' : ''} created`);
      if (updated) parts.push(`${updated} updated`);
      if (skipped) parts.push(`${skipped} skipped`);

      return { success: true, action: 'csv_confirm', message: parts.join(', ') + '.' };
    } catch (err) {
      console.error('csv_confirm error:', err);
      return { success: false, error: 'Failed to save: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },
};