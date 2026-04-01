// src/routes/corp/reports/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
  requirePermission(locals.user, 'corp', 'manager');
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

    const pastReports = await sql`
      SELECT report_id, report_title, report_type, date_range_start, date_range_end,
             pdf_filename, file_size_bytes, generated_by, created_at
      FROM generated_reports
      WHERE report_type = 'corp_engagements'
      ORDER BY created_at DESC
      LIMIT 20
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
      pastReports: pastReports.map(r => ({
        ...r,
        date_range_start: r.date_range_start instanceof Date ? r.date_range_start.toISOString().split('T')[0] : String(r.date_range_start || '').slice(0, 10),
        date_range_end: r.date_range_end instanceof Date ? r.date_range_end.toISOString().split('T')[0] : String(r.date_range_end || '').slice(0, 10),
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ''),
      })),
    };
  } catch (err) {
    console.error('Error loading corp reports:', err);
    return { engagements: [], companies: [], industries: [], pastReports: [] };
  }
};

export const actions = {
  generate_pdf: async ({ request, locals }) => {
    requirePermission(locals.user, 'corp', 'manager');

    const formData = await request.formData();
    const reportTitle = formData.get('report_title')?.toString().trim() || 'Corp Report';
    const dateStart = formData.get('date_range_start')?.toString() || '';
    const dateEnd = formData.get('date_range_end')?.toString() || '';
    const filtersJson = formData.get('filters')?.toString() || '{}';
    const chartsJson = formData.get('charts')?.toString() || '[]';
    const pdfBase64 = formData.get('pdf_base64')?.toString() || '';

    if (!pdfBase64) return { success: false, error: 'No PDF data received.' };

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const fileSize = pdfBuffer.length;
    const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    try {
      const [report] = await sql`
        INSERT INTO generated_reports (
          report_title, report_type, date_range_start, date_range_end,
          datasets, charts, pdf_data, pdf_filename, file_size_bytes, generated_by
        ) VALUES (
          ${reportTitle}, 'corp_engagements',
          ${dateStart ? dateStart + '-01' : dateStart},
          ${dateEnd ? dateEnd + '-01' : dateEnd},
          ${filtersJson}, ${chartsJson},
          ${pdfBuffer}, ${filename}, ${fileSize},
          ${locals.user?.display_name || locals.user?.email || 'admin'}
        )
        RETURNING report_id, report_title, created_at
      `;
      console.log(`[corp_reports] Saved report ${report.report_id}: ${reportTitle} (${fileSize} bytes)`);
      return { success: true, message: `Report "${reportTitle}" saved.`, reportId: report.report_id };
    } catch (error) {
      console.error('Error saving corp report:', error);
      return { success: false, error: 'Failed to save report: ' + /** @type {Error} */ (error).message };
    }
  },
};