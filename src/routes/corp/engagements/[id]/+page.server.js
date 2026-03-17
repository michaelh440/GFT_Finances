// src/routes/corp/engagements/[id]/+page.server.js
import sql from '$lib/db';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const id = parseInt(params.id);

  const rows = await sql`
    SELECT
      e.corp_engagement_id, e.corp_contact_id,
      e.title, e.dubsado_project_title,
      e.engagement_type, e.pipeline_status, e.contract_status,
      e.engagement_date::text, e.end_date::text,
      e.audience_size_min, e.audience_size_max, e.audience_size_approx,
      e.amount_paid, e.notes, e.is_archived,
      c.company_name, c.first_name, c.last_name,
      c.email AS contact_email
    FROM corp_engagements e
    LEFT JOIN corp_contacts c ON c.corp_contact_id = e.corp_contact_id
    WHERE e.corp_engagement_id = ${id}
  `;
  if (!rows.length) throw error(404, 'Engagement not found');

  const contacts = await sql`
    SELECT corp_contact_id, company_name, first_name, last_name
    FROM corp_contacts
    ORDER BY company_name ASC NULLS LAST
  `;

  return {
    engagement: {
      ...rows[0],
      amount_paid: rows[0].amount_paid ? parseFloat(rows[0].amount_paid) : null,
    },
    contacts: contacts.map(c => ({ ...c })),
  };
}

export const actions = {
  updateEngagement: async ({ request, params }) => {
    const id   = parseInt(params.id);
    const form = await request.formData();
    const g  = (/** @type {string} */ k) => form.get(k)?.toString() || null;
    const gn = (/** @type {string} */ k) => { const v = form.get(k)?.toString(); return v ? parseFloat(v) : null; };
    const gi = (/** @type {string} */ k) => { const v = form.get(k)?.toString(); return v ? parseInt(v) : null; };

    await sql`
      UPDATE corp_engagements SET
        corp_contact_id      = ${gi('corp_contact_id')},
        title                = ${g('title')},
        engagement_type      = ${g('engagement_type')},
        pipeline_status      = ${g('pipeline_status')},
        contract_status      = ${g('contract_status') || null},
        engagement_date      = ${g('engagement_date') || null},
        end_date             = ${g('end_date') || null},
        audience_size_min    = ${gi('audience_size_min')},
        audience_size_max    = ${gi('audience_size_max')},
        audience_size_approx = ${form.get('audience_size_approx') === 'on'},
        amount_paid          = ${gn('amount_paid')},
        notes                = ${g('notes')},
        is_archived          = ${form.get('is_archived') === 'on'},
        updated_at           = NOW()
      WHERE corp_engagement_id = ${id}
    `;

    return { success: true };
  },
};