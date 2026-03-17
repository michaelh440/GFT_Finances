// src/routes/corp/contacts/[id]/+page.server.js
import sql from '$lib/db';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const id = parseInt(params.id);

  const contactRows = await sql`
    SELECT
      corp_contact_id, company_name, first_name, last_name,
      email, phone, address_line1, address_line2,
      city, state, zip, country,
      created_at::text, updated_at::text
    FROM corp_contacts WHERE corp_contact_id = ${id}
  `;
  if (!contactRows.length) throw error(404, 'Contact not found');

  const engRows = await sql`
    SELECT
      corp_engagement_id, title, engagement_type,
      pipeline_status, contract_status,
      engagement_date::text, amount_paid, notes, is_archived
    FROM corp_engagements
    WHERE corp_contact_id = ${id}
    ORDER BY engagement_date DESC NULLS LAST
  `;

  return {
    contact:     contactRows[0],
    engagements: engRows.map(r => ({
      ...r,
      amount_paid: r.amount_paid ? parseFloat(r.amount_paid) : null,
    })),
  };
}

export const actions = {
  updateContact: async ({ request, params }) => {
    const id   = parseInt(params.id);
    const form = await request.formData();
    const g = (/** @type {string} */ k) => form.get(k)?.toString() || null;

    await sql`
      UPDATE corp_contacts SET
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
};