// src/routes/corp/reports/+page.server.js
import sql from '$lib/db';

export const load = async () => {
  try {
    // All engagements with company/industry info
    const engagements = await sql`
      SELECT
        e.corp_engagement_id,
        e.engagement_type,
        e.engagement_date,
        e.amount_paid,
        e.pipeline_status,
        e.contract_status,
        e.is_archived,
        EXTRACT(YEAR  FROM e.engagement_date)::int  AS eng_year,
        EXTRACT(MONTH FROM e.engagement_date)::int  AS eng_month,
        c.corp_contact_id,
        c.corp_company_id,
        co.company_name,
        co.industry,
        co.parent_company_id
      FROM corp_engagements e
      JOIN corp_contacts c    ON c.corp_contact_id   = e.corp_contact_id
      JOIN corp_companies co  ON co.corp_company_id  = c.corp_company_id
      WHERE e.engagement_date IS NOT NULL
        AND co.status = 'active'
      ORDER BY e.engagement_date DESC
    `;

    // Active companies (for filter dropdown)
    const companies = await sql`
      SELECT corp_company_id, company_name, industry, parent_company_id
      FROM corp_companies
      WHERE status = 'active'
      ORDER BY company_name
    `;

    // Distinct industries
    const industries = await sql`
      SELECT DISTINCT industry
      FROM corp_companies
      WHERE industry IS NOT NULL AND TRIM(industry) != ''
        AND status = 'active'
      ORDER BY industry
    `;

    return {
      engagements: engagements.map(e => ({
        ...e,
        amount_paid: e.amount_paid ? parseFloat(e.amount_paid) : 0,
        eng_year:  Number(e.eng_year),
        eng_month: Number(e.eng_month),
      })),
      companies,
      industries: industries.map(r => r.industry),
    };
  } catch (err) {
    console.error('Error loading corp reports:', err);
    return { engagements: [], companies: [], industries: [] };
  }
};