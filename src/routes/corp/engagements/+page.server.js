// src/routes/corp/engagements/+page.server.js
import sql from '$lib/db';

export async function load({ url }) {
  const type     = url.searchParams.get('type')     ?? '';
  const pipeline = url.searchParams.get('pipeline') ?? '';
  const contract = url.searchParams.get('contract') ?? '';
  // Default to showing archived records since all Dubsado imports are archived.
  // Pass archived=0 explicitly to hide them.
  const archived = url.searchParams.get('archived') !== '0';

  // postgres.js doesn't support fully dynamic WHERE, so fetch all
  // and filter server-side — clean and avoids query explosion.
  const rows = await sql`
    SELECT e.corp_engagement_id, e.title, e.engagement_type,
           e.pipeline_status, e.contract_status,
           e.engagement_date::text, e.audience_size_min, e.audience_size_max,
           e.amount_paid, e.is_archived,
           c.company_name, c.corp_contact_id, c.corp_company_id
    FROM corp_engagements e
    LEFT JOIN corp_contacts c ON c.corp_contact_id = e.corp_contact_id
    WHERE e.is_archived = ${archived}
    ORDER BY e.engagement_date DESC NULLS LAST
  `;

  const engagements = rows
    .filter(r => !type     || r.engagement_type  === type)
    .filter(r => !pipeline || r.pipeline_status  === pipeline)
    .filter(r => !contract || r.contract_status  === contract)
    .map(r => ({
      ...r,
      amount_paid: r.amount_paid ? parseFloat(r.amount_paid) : null,
    }));

  return {
    engagements,
    filters: { type, pipeline, contract, archived },
  };
}