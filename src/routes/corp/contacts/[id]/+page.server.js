// src/routes/corp/contacts/[id]/+page.server.js
import sql from '$lib/db';
import { error } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';

export async function load({ params, locals }) {
  requirePermission(locals.user, 'corp', 'viewer');
  const id = parseInt(params.id);

  const [contactRows, engRows, historyRows, workflowRows] = await Promise.all([
    sql`
      SELECT
        corp_contact_id, corp_company_id, company_name, first_name, last_name,
        email, phone, address_line1, address_line2,
        city, state, zip, country,
        created_at::text, updated_at::text
      FROM corp_contacts WHERE corp_contact_id = ${id}
    `,
    sql`
      SELECT
        corp_engagement_id, title, engagement_type,
        pipeline_status, contract_status,
        engagement_date::text, amount_paid, notes, is_archived
      FROM corp_engagements
      WHERE corp_contact_id = ${id}
      ORDER BY engagement_date DESC NULLS LAST
    `,
    sql`
      SELECT
        history_id, company_name, email, phone, notes,
        effective_date::text, created_at::text
      FROM corp_contact_history
      WHERE corp_contact_id = ${id}
      ORDER BY created_at DESC
    `,
    sql`
      SELECT category, value, label
      FROM corp_workflow
      WHERE is_active = TRUE
      ORDER BY category, sort_order
    `,
  ]);

  if (!contactRows.length) throw error(404, 'Contact not found');

  const workflow = {
    engagement_types:  workflowRows.filter(r => r.category === 'engagement_type'),
    pipeline_statuses: workflowRows.filter(r => r.category === 'pipeline_status'),
    contract_statuses: workflowRows.filter(r => r.category === 'contract_status'),
  };

  return {
    contact:     contactRows[0],
    engagements: engRows.map(r => ({
      ...r,
      amount_paid: r.amount_paid ? parseFloat(r.amount_paid) : null,
    })),
    history: historyRows,
    workflow,
  };
}

export const actions = {
  updateContact: async ({ request, params, locals }) => {
    requirePermission(locals.user, 'corp', 'data_entry');
    const id   = parseInt(params.id);
    const form = await request.formData();
    const g = (/** @type {string} */ k) => form.get(k)?.toString() || null;

    // Before updating, snapshot current values to history if they differ
    const current = await sql`
      SELECT company_name, email, phone FROM corp_contacts WHERE corp_contact_id = ${id}
    `;
    const cur = current[0] ?? {};
    const newCompany = g('company_name');
    const newEmail   = g('email');
    const newPhone   = g('phone');

    const changed =
      (newCompany ?? '') !== (cur.company_name ?? '') ||
      (newEmail   ?? '') !== (cur.email        ?? '') ||
      (newPhone   ?? '') !== (cur.phone        ?? '');

    if (changed) {
      const lastH = await sql`
        SELECT company_name, email, phone FROM corp_contact_history
        WHERE corp_contact_id = ${id}
        ORDER BY created_at DESC LIMIT 1
      `;
      const last = lastH[0] ?? null;
      const differsFromLast =
        !last ||
        (cur.company_name ?? '') !== (last.company_name ?? '') ||
        (cur.email        ?? '') !== (last.email        ?? '') ||
        (cur.phone        ?? '') !== (last.phone        ?? '');

      if (differsFromLast) {
        // Look up corp_company_id for current company before overwriting
        const curCoRows = await sql`
          SELECT corp_company_id FROM corp_companies
          WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(${cur.company_name ?? ''}))
          LIMIT 1
        `;
        const curCompanyId = curCoRows[0]?.corp_company_id ?? null;

        await sql`
          INSERT INTO corp_contact_history (corp_contact_id, company_name, email, phone, notes, corp_company_id)
          VALUES (${id}, ${cur.company_name ?? null}, ${cur.email ?? null}, ${cur.phone ?? null},
                  ${'Previous values before manual update'}, ${curCompanyId})
        `;
      }
    }

    // Resolve new company ID
    let newCompanyId = null;
    if (newCompany) {
      const coRows = await sql`
        SELECT corp_company_id FROM corp_companies
        WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(${newCompany}))
        LIMIT 1
      `;
      newCompanyId = coRows[0]?.corp_company_id ?? null;
    }

    await sql`
      UPDATE corp_contacts SET
        corp_company_id = ${newCompanyId},
        company_name  = ${g('company_name')},
        first_name    = ${g('first_name')},
        last_name     = ${g('last_name')},
        email         = ${g('email')},
        phone         = ${g('phone')},
        address_line1 = ${g('address_line1')},
        address_line2 = ${g('address_line2')},
        city          = ${g('city')},
        state         = ${g('state')},
        zip           = ${g('zip')},
        country       = ${g('country')},
        updated_at    = NOW()
      WHERE corp_contact_id = ${id}
    `;

    return { success: true };
  },

  addHistory: async ({ request, params, locals }) => {
    requirePermission(locals.user, 'corp', 'data_entry');
    const id   = parseInt(params.id);
    const form = await request.formData();
    const g = (/** @type {string} */ k) => form.get(k)?.toString() || null;

    const companyName = g('company_name');
    let companyId = null;
    if (companyName) {
      const coRows = await sql`
        SELECT corp_company_id FROM corp_companies
        WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(${companyName}))
        LIMIT 1
      `;
      companyId = coRows[0]?.corp_company_id ?? null;
    }

    await sql`
      INSERT INTO corp_contact_history
        (corp_contact_id, company_name, email, phone, notes, effective_date, corp_company_id)
      VALUES (
        ${id},
        ${companyName},
        ${g('email')},
        ${g('phone')},
        ${g('notes')},
        ${g('effective_date') || null},
        ${companyId}
      )
    `;

    return { success: true, action: 'addHistory' };
  },
};