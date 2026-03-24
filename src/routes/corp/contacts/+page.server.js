// src/routes/corp/contacts/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export async function load({ locals }) {
  requirePermission(locals.user, 'corp', 'viewer');
  const rows = await sql`
    SELECT
      c.corp_contact_id,
      c.corp_company_id,
      c.company_name,
      c.first_name,
      c.last_name,
      c.email,
      c.phone,
      c.city,
      c.state,
      COUNT(e.corp_engagement_id)::int  AS engagement_count,
      SUM(e.amount_paid)                AS total_revenue,
      MAX(e.engagement_date)::text      AS last_engagement_date
    FROM corp_contacts c
    LEFT JOIN corp_engagements e ON e.corp_contact_id = c.corp_contact_id
    GROUP BY c.corp_contact_id
    ORDER BY c.company_name ASC NULLS LAST
  `;

  return {
    contacts: rows.map(r => ({
      ...r,
      total_revenue:    r.total_revenue    ? parseFloat(r.total_revenue) : null,
      engagement_count: r.engagement_count ?? 0,
    })),
    user: locals.user,
  };
}