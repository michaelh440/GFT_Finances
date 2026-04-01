// src/routes/shows/reports/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'gft', 'manager');
	try {
		const [shows, summaries, pastReports] = await Promise.all([
			sql`
				SELECT show_code, show_name, format, audience_type, day_of_week, standard_ticket_price
				FROM shows
				WHERE is_active = true
				ORDER BY format ASC, show_name ASC
			`,
			sql`
				SELECT mss.show_code, mss.summary_month, mss.summary_year, mss.tickets_sold, mss.revenue,
				       s.show_name, s.format, s.audience_type, s.day_of_week
				FROM monthly_show_summary mss
				JOIN shows s ON mss.show_code = s.show_code
				ORDER BY mss.summary_month ASC
			`,
			sql`
				SELECT report_id, report_title, report_type, date_range_start, date_range_end,
				       pdf_filename, file_size_bytes, generated_by, created_at
				FROM generated_reports
				WHERE report_type = 'gft_shows'
				ORDER BY created_at DESC
				LIMIT 20
			`,
		]);

		return {
			shows: shows.map((s) => ({
				...s,
				standard_ticket_price: Number(s.standard_ticket_price || 0)
			})),
			summaries: summaries.map((s) => ({
				...s,
				summary_month: s.summary_month.toISOString().split('T')[0],
				summary_year: Number(s.summary_year),
				tickets_sold: Number(s.tickets_sold),
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
		};
	} catch (error) {
		console.error('Error loading show report data:', error);
		return { shows: [], summaries: [], pastReports: [] };
	}
};

export const actions = {
	generate_pdf: async ({ request, locals }) => {
		requirePermission(locals.user, 'gft', 'manager');

		const formData = await request.formData();
		const reportTitle = formData.get('report_title')?.toString().trim() || 'GFT Show Report';
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
					${reportTitle}, 'gft_shows',
					${dateStart ? dateStart + '-01' : null},
					${dateEnd ? dateEnd + '-01' : null},
					${filtersJson}, ${chartsJson},
					${pdfBuffer}, ${filename}, ${fileSize},
					${locals.user?.display_name || locals.user?.email || 'admin'}
				)
				RETURNING report_id, report_title, created_at
			`;

			console.log(`[gft_reports] Saved report ${report.report_id}: ${reportTitle} (${fileSize} bytes)`);

			return { success: true, message: `Report "${reportTitle}" saved.`, reportId: report.report_id };
		} catch (error) {
			console.error('Error saving GFT report:', error);
			return { success: false, error: 'Failed to save report: ' + /** @type {Error} */ (error).message };
		}
	},
};
