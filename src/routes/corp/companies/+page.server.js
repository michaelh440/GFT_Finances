// src/routes/corp/companies/+page.server.js
import sql from '$lib/db';

const PAGE_SIZE = 50;

export const load = async ({ url }) => {

  // ── Read filter params ────────────────────────────────────────────────
  const search         = url.searchParams.get('search')          || '';
  const yearsParam     = url.searchParams.get('years')           || '';
  const month          = url.searchParams.get('month')           || '';
  const engType        = url.searchParams.get('eng_type')        || '';
  const pipelineStatus = url.searchParams.get('pipeline_status') || '';
  const contractStatus = url.searchParams.get('contract_status') || '';
  const hasRevenue     = url.searchParams.get('has_revenue')     || '';  // 'yes' | 'no' | ''
  const status         = url.searchParams.get('status')          || 'active';
  const parentId       = url.searchParams.get('parent_id')       || '';
  const currentPage    = Math.max(1, parseInt(url.searchParams.get('page') || '1'));

  const selectedYears = yearsParam.split(',').filter(Boolean)
    .map(y => parseInt(y)).filter(y => !isNaN(y));

  // ── Filter option lists ───────────────────────────────────────────────
  const yearRows = await sql`
    SELECT DISTINCT EXTRACT(YEAR FROM engagement_date)::int AS yr
    FROM corp_engagements
    WHERE engagement_date IS NOT NULL
    ORDER BY yr DESC
  `;

  const parentRows = await sql`
    SELECT corp_company_id, company_name
    FROM corp_companies
    WHERE parent_company_id IS NULL
      AND status = 'active'
    ORDER BY company_name
  `;

  // ── Engagement-level filter conditions ────────────────────────────────
  const engConditions = [];
  if (selectedYears.length > 0)
    engConditions.push(sql`EXTRACT(YEAR FROM e.engagement_date)::int = ANY(${selectedYears})`);
  if (month)
    engConditions.push(sql`EXTRACT(MONTH FROM e.engagement_date)::int = ${parseInt(month)}`);
  if (engType)
    engConditions.push(sql`e.engagement_type = ${engType}`);
  if (pipelineStatus)
    engConditions.push(sql`e.pipeline_status = ${pipelineStatus}`);
  if (contractStatus)
    engConditions.push(sql`e.contract_status = ${contractStatus}`);

  const engWhere = engConditions.length > 0
    ? sql`AND ${engConditions.reduce((a, b) => sql`${a} AND ${b}`)}`
    : sql``;

  // hasRevenue applies as a HAVING condition after grouping, not a row filter
  const revenueHaving =
    hasRevenue === 'yes' ? sql`AND SUM(e.amount_paid) > 0` :
    hasRevenue === 'no'  ? sql`AND (SUM(e.amount_paid) IS NULL OR SUM(e.amount_paid) = 0)` :
    sql``;

  const hasEngFilter = engConditions.length > 0 || hasRevenue !== '';

  // ── Company-level filter conditions ───────────────────────────────────
  const coConditions = [];

  if (status === 'active')       coConditions.push(sql`co.status = 'active'`);
  else if (status === 'merged')  coConditions.push(sql`co.status = 'merged'`);
  else if (status === 'deactivated') coConditions.push(sql`co.status = 'deactivated'`);

  if (parentId)
    coConditions.push(sql`(co.corp_company_id = ${parseInt(parentId)} OR co.parent_company_id = ${parseInt(parentId)})`);

  if (search)
    coConditions.push(sql`LOWER(co.company_name) LIKE ${'%' + search.toLowerCase() + '%'}`);

  const coWhere = coConditions.length > 0
    ? sql`WHERE ${coConditions.reduce((a, b) => sql`${a} AND ${b}`)}`
    : sql`WHERE 1=1`;

  // ── Stats query ────────────────────────────────────────────────────────
  // Use a CTE to first get the filtered company IDs, then aggregate stats
  // against only those companies. This avoids the HAVING-without-GROUP-BY trap.
  const statsRows = await sql`
    WITH filtered_companies AS (
      SELECT co.corp_company_id
      FROM corp_companies co
      LEFT JOIN corp_contacts c
             ON c.corp_company_id = co.corp_company_id
      LEFT JOIN corp_engagements e
             ON e.corp_contact_id = c.corp_contact_id ${engWhere}
      ${coWhere}
      GROUP BY co.corp_company_id
      ${hasEngFilter ? sql`HAVING COUNT(DISTINCT e.corp_engagement_id) > 0 ${revenueHaving}` : revenueHaving}
    )
    SELECT
      COUNT(DISTINCT co.corp_company_id)::int   AS company_count,
      COUNT(DISTINCT c.corp_contact_id)::int    AS contact_count,
      COUNT(DISTINCT e.corp_engagement_id)::int AS engagement_count,
      COALESCE(SUM(e.amount_paid), 0)           AS total_revenue
    FROM corp_companies co
    JOIN filtered_companies fc ON fc.corp_company_id = co.corp_company_id
    LEFT JOIN corp_contacts c
           ON c.corp_company_id = co.corp_company_id
    LEFT JOIN corp_engagements e
           ON e.corp_contact_id = c.corp_contact_id ${engWhere}
  `;

  // ── Count query for pagination ─────────────────────────────────────────
  const countRows = await sql`
    SELECT COUNT(*)::int AS total FROM (
      SELECT co.corp_company_id
      FROM corp_companies co
      LEFT JOIN corp_contacts c
             ON c.corp_company_id = co.corp_company_id
      LEFT JOIN corp_engagements e
             ON e.corp_contact_id = c.corp_contact_id ${engWhere}
      ${coWhere}
      GROUP BY co.corp_company_id
      ${hasEngFilter ? sql`HAVING COUNT(DISTINCT e.corp_engagement_id) > 0 ${revenueHaving}` : revenueHaving}
    ) sub
  `;

  const totalCount = countRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const offset     = (safePage - 1) * PAGE_SIZE;

  // ── Main listing query ────────────────────────────────────────────────
  const rows = await sql`
    SELECT
      co.corp_company_id,
      co.company_name,
      co.industry,
      co.website,
      co.status,
      co.parent_company_id,
      pc.company_name                            AS parent_company_name,
      COUNT(DISTINCT c.corp_contact_id)::int     AS active_contacts,
      COUNT(DISTINCT h.corp_contact_id)::int     AS prev_contacts,
      COUNT(DISTINCT e.corp_engagement_id)::int  AS engagement_count,
      SUM(e.amount_paid)                         AS total_revenue,
      MAX(e.engagement_date)::text               AS last_engagement_date
    FROM corp_companies co
    LEFT JOIN corp_companies pc
           ON pc.corp_company_id = co.parent_company_id
    LEFT JOIN corp_contacts c
           ON c.corp_company_id = co.corp_company_id
    LEFT JOIN corp_contact_history h
           ON h.corp_company_id = co.corp_company_id
          AND h.corp_contact_id NOT IN (
            SELECT corp_contact_id FROM corp_contacts
            WHERE corp_company_id = co.corp_company_id
          )
    LEFT JOIN corp_engagements e
           ON e.corp_contact_id = c.corp_contact_id ${engWhere}
    ${coWhere}
    GROUP BY co.corp_company_id, pc.company_name
    ${hasEngFilter ? sql`HAVING COUNT(DISTINCT e.corp_engagement_id) > 0 ${revenueHaving}` : revenueHaving}
    ORDER BY co.company_name
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  return {
    companies: rows.map(r => ({
      ...r,
      total_revenue:    r.total_revenue    ? parseFloat(r.total_revenue)    : null,
      active_contacts:  r.active_contacts  ?? 0,
      prev_contacts:    r.prev_contacts    ?? 0,
      engagement_count: r.engagement_count ?? 0,
    })),
    stats: {
      company_count:    statsRows[0]?.company_count    ?? 0,
      contact_count:    statsRows[0]?.contact_count    ?? 0,
      engagement_count: statsRows[0]?.engagement_count ?? 0,
      total_revenue:    statsRows[0]?.total_revenue
        ? parseFloat(statsRows[0].total_revenue) : 0,
    },
    pagination: {
      currentPage: safePage,
      totalPages,
      pageSize:    PAGE_SIZE,
      totalCount,
    },
    years:   yearRows.map(r => r.yr),
    parents: parentRows,
    filters: { search, yearsParam, month, engType, pipelineStatus, contractStatus, hasRevenue, status, parentId },
  };
};