// src/routes/hsi/reports/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'hsi', 'manager');
	try {
		const [classes, summaries, pastReports, teacherClasses] = await Promise.all([
			sql`
				SELECT class_code, class_name, class_type, student_type, standard_price, track
				FROM classes
				WHERE is_active = true
				ORDER BY track ASC, class_name ASC
			`,
			sql`
				SELECT mcs.class_code, mcs.summary_month, mcs.summary_year, mcs.registrations, mcs.revenue,
				       c.class_name, c.track
				FROM monthly_class_summary mcs
				JOIN classes c ON mcs.class_code = c.class_code
				ORDER BY mcs.summary_month ASC
			`,
			sql`
				SELECT report_id, report_title, report_type, date_range_start, date_range_end,
				       pdf_filename, file_size_bytes, generated_by, created_at
				FROM generated_reports
				WHERE report_type = 'hsi_classes'
				ORDER BY created_at DESC
				LIMIT 20
			`,
			sql`
				SELECT DISTINCT t.teacher_id, t.first_name || ' ' || t.last_name AS instructor, cs.class_code
				FROM class_sessions cs
				JOIN teachers t ON cs.teacher_id = t.teacher_id
				ORDER BY instructor, cs.class_code
			`,
		]);

		return {
			classes: classes.map((c) => ({
				...c,
				standard_price: Number(c.standard_price)
			})),
			summaries: summaries.map((s) => ({
				...s,
				summary_month: s.summary_month.toISOString().split('T')[0],
				summary_year: Number(s.summary_year),
				registrations: Number(s.registrations),
				revenue: Number(s.revenue)
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
			teacherClasses,
		};
	} catch (error) {
		console.error('Error loading report data:', error);
		return { classes: [], summaries: [], pastReports: [] };
	}
};

export const actions = {
	generate_pdf: async ({ request, locals }) => {
		requirePermission(locals.user, 'hsi', 'manager');

		const formData = await request.formData();
		const reportTitle = formData.get('report_title')?.toString().trim() || 'HSI Class Report';
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
					${reportTitle}, 'hsi_classes',
					${dateStart ? dateStart + '-01' : dateStart},
					${dateEnd ? dateEnd + '-01' : dateEnd},
					${filtersJson}, ${chartsJson},
					${pdfBuffer}, ${filename}, ${fileSize},
					${locals.user?.display_name || locals.user?.email || 'admin'}
				)
				RETURNING report_id, report_title, created_at
			`;

			console.log(`[hsi_reports] Saved report ${report.report_id}: ${reportTitle} (${fileSize} bytes)`);

			return { success: true, message: `Report "${reportTitle}" saved.`, reportId: report.report_id };
		} catch (error) {
			console.error('Error saving HSI report:', error);
			return { success: false, error: 'Failed to save report: ' + /** @type {Error} */ (error).message };
		}
	},
};
