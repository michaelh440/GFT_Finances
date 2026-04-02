// src/routes/hsi/registrations/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'manager');
	try {
		// Get all distinct student+class+year combos for client-side funnel filtering
		const allRegistrations = await sql`
      SELECT DISTINCT
        r.student_id,
        r.class_code,
        EXTRACT(YEAR FROM r.class_date)::INTEGER AS reg_year
      FROM registrations r
      WHERE r.class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
      ORDER BY r.student_id, r.class_code
    `;

		// Get available years
		const years = await sql`
      SELECT DISTINCT EXTRACT(YEAR FROM class_date)::INTEGER AS year
      FROM registrations
      WHERE class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
      ORDER BY year ASC
    `;

		// Get class names for display
		const classNames = await sql`
      SELECT class_code, class_name
      FROM classes
      WHERE class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
    `;

		// Monthly breakdown for monthly charts
		const monthlyFunnel = await sql`
      WITH student_classes AS (
        SELECT DISTINCT student_id, class_code
        FROM registrations
        WHERE class_code IN ('CT1', 'CT2', 'CT3', 'AGT1')
      ),
      ct2_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT2'),
      ct3_students AS (SELECT student_id FROM student_classes WHERE class_code = 'CT3'),
      agt1_students AS (SELECT student_id FROM student_classes WHERE class_code = 'AGT1'),
      earliest_reg AS (
        SELECT student_id, class_code, MIN(class_date) AS first_reg_date
        FROM registrations
        WHERE class_code IN ('CT1', 'CT2', 'CT3')
        GROUP BY student_id, class_code
      )
      SELECT
        DATE_TRUNC('month', er.first_reg_date)::DATE AS reg_month,
        er.class_code,
        COUNT(*) AS total_students,
        COUNT(*) FILTER (WHERE
          (er.class_code = 'CT1' AND er.student_id NOT IN (SELECT student_id FROM ct2_students))
          OR (er.class_code = 'CT2' AND er.student_id NOT IN (SELECT student_id FROM ct3_students))
          OR (er.class_code = 'CT3' AND er.student_id NOT IN (SELECT student_id FROM agt1_students))
        ) AS did_not_continue,
        COUNT(*) FILTER (WHERE
          (er.class_code = 'CT1' AND er.student_id IN (SELECT student_id FROM ct2_students))
          OR (er.class_code = 'CT2' AND er.student_id IN (SELECT student_id FROM ct3_students))
          OR (er.class_code = 'CT3' AND er.student_id IN (SELECT student_id FROM agt1_students))
        ) AS continued
      FROM earliest_reg er
      GROUP BY DATE_TRUNC('month', er.first_reg_date), er.class_code
      ORDER BY reg_month ASC, er.class_code ASC
    `;

		/** @type {Record<string, string>} */
		const classNameMap = {};
		for (const c of classNames) {
			classNameMap[c.class_code] = c.class_name;
		}

		const pastReports = await sql`
			SELECT report_id, report_title, report_type, date_range_start, date_range_end,
			       pdf_filename, file_size_bytes, generated_by, created_at
			FROM generated_reports
			WHERE report_type = 'hsi_registrations'
			ORDER BY created_at DESC
			LIMIT 20
		`;

		return {
			classNameMap,
			registrations: allRegistrations.map((r) => ({
				student_id: r.student_id,
				class_code: r.class_code,
				reg_year: Number(r.reg_year)
			})),
			years: years.map((y) => Number(y.year)),
			monthlyFunnel: monthlyFunnel.map((r) => ({
				reg_month: r.reg_month.toISOString().split('T')[0],
				class_code: r.class_code,
				total_students: Number(r.total_students),
				did_not_continue: Number(r.did_not_continue),
				continued: Number(r.continued)
			})),
			pastReports: pastReports.map((r) => ({
				...r,
				date_range_start: r.date_range_start instanceof Date
					? r.date_range_start.toISOString().split('T')[0]
					: String(r.date_range_start || '').slice(0, 10),
				date_range_end: r.date_range_end instanceof Date
					? r.date_range_end.toISOString().split('T')[0]
					: String(r.date_range_end || '').slice(0, 10),
				created_at: r.created_at instanceof Date
					? r.created_at.toISOString()
					: String(r.created_at || '')
			})),
		};
	} catch (error) {
		console.error('Error loading registration funnel data:', error);
		return {
			registrations: [],
			years: [],
			monthlyFunnel: [],
			pastReports: []
		};
	}
};

export const actions = {
	generate_pdf: async ({ request, locals }) => {
		requirePermission(locals.user, 'hsi', 'manager');

		const formData = await request.formData();
		const reportTitle = formData.get('report_title')?.toString().trim() || 'Registration Funnel Report';
		const dateStart = formData.get('date_range_start')?.toString() || '';
		const dateEnd = formData.get('date_range_end')?.toString() || '';
		const filtersJson = formData.get('filters')?.toString() || '{}';
		const chartsJson = formData.get('charts')?.toString() || '[]';
		const pdfBase64 = formData.get('pdf_base64')?.toString() || '';

		if (!pdfBase64) {
			return { success: false, error: 'No PDF data received.' };
		}

		const pdfBuffer = Buffer.from(pdfBase64, 'base64');
		const fileSize = pdfBuffer.length;
		const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

		try {
			const [report] = await sql`
				INSERT INTO generated_reports (
					report_title, report_type, date_range_start, date_range_end,
					datasets, charts, pdf_data, pdf_filename, file_size_bytes, generated_by
				) VALUES (
					${reportTitle}, 'hsi_registrations',
					${dateStart || null},
					${dateEnd || null},
					${filtersJson}, ${chartsJson},
					${pdfBuffer}, ${filename}, ${fileSize},
					${locals.user?.display_name || locals.user?.email || 'admin'}
				)
				RETURNING report_id, report_title, created_at
			`;

			console.log(`[hsi_registrations] Saved report ${report.report_id}: ${reportTitle} (${fileSize} bytes)`);

			return { success: true, message: `Report "${reportTitle}" saved.`, reportId: report.report_id };
		} catch (error) {
			console.error('Error saving registration report:', error);
			return { success: false, error: 'Failed to save report: ' + /** @type {Error} */ (error).message };
		}
	},
};
