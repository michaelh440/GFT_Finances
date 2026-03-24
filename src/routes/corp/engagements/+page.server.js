// src/routes/corp/engagements/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export async function load({ url, locals }) {
  requirePermission(locals.user, 'corp', 'viewer');
  const type     = url.searchParams.get('type')     ?? '';
  const pipeline = url.searchParams.get('pipeline') ?? '';
  const contract = url.searchParams.get('contract') ?? '';
  const archived = url.searchParams.get('archived') !== '0';

  const [rows, workflowRows] = await Promise.all([
    sql`
      SELECT e.corp_engagement_id, e.title, e.engagement_type,
             e.pipeline_status, e.contract_status,
             e.engagement_date::text, e.audience_size_min, e.audience_size_max,
             e.amount_paid, e.is_archived,
             c.company_name, c.corp_contact_id, c.corp_company_id
      FROM corp_engagements e
      LEFT JOIN corp_contacts c ON c.corp_contact_id = e.corp_contact_id
      WHERE e.is_archived = ${archived}
      ORDER BY e.engagement_date DESC NULLS LAST
    `,
    sql`
      SELECT category, value, label, sort_order
      FROM corp_workflow
      WHERE is_active = TRUE
      ORDER BY category, sort_order
    `,
  ]);

  const engagements = rows
    .filter(r => !type     || r.engagement_type  === type)
    .filter(r => !pipeline || r.pipeline_status  === pipeline)
    .filter(r => !contract || r.contract_status  === contract)
    .map(r => ({
      ...r,
      amount_paid: r.amount_paid ? parseFloat(r.amount_paid) : null,
    }));

  const workflow = {
    engagement_types:  workflowRows.filter(r => r.category === 'engagement_type'),
    pipeline_statuses: workflowRows.filter(r => r.category === 'pipeline_status'),
    contract_statuses: workflowRows.filter(r => r.category === 'contract_status'),
  };

  return {
    engagements,
    workflow,
    filters: { type, pipeline, contract, archived },
    user: locals.user,
  };
}