// src/routes/reports/2026/monthly_reporting/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const summaries = await sql`
			SELECT
				source_type,
				item_code,
				item_name,
				category,
				source_label,
				summary_month,
				summary_year,
				summary_month_num,
				unit_count,
				revenue
			FROM monthly_combined_summary
			ORDER BY summary_month DESC, source_type, item_name
		`;

		const showItems = await sql`
			SELECT show_code AS item_code, show_name AS item_name, format AS category
			FROM shows WHERE is_active = true ORDER BY show_name
		`;

		const classItems = await sql`
			SELECT class_code AS item_code, class_name AS item_name, track AS category
			FROM classes WHERE is_active = true ORDER BY class_name
		`;

		// Get previously generated reports
		const pastReports = await sql`
			SELECT report_id, report_title, report_type, date_range_start, date_range_end,
			       datasets, charts, pdf_filename, file_size_bytes, generated_by, created_at
			FROM generated_reports
			ORDER BY created_at DESC
			LIMIT 20
		`;

		return {
			summaries: summaries.map((s) => ({
				...s,
				summary_month: s.summary_month instanceof Date
					? s.summary_month.toISOString().split('T')[0]
					: String(s.summary_month || '').slice(0, 10),
				unit_count: Number(s.unit_count || 0),
				revenue: Number(s.revenue || 0),
				summary_year: Number(s.summary_year),
				summary_month_num: Number(s.summary_month_num)
			})),
			showItems,
			classItems,
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
			}))
		};
	} catch (error) {
		console.error('Error loading reporting data:', error);
		return { summaries: [], showItems: [], classItems: [], pastReports: [] };
	}
};

export const actions = {
	generate_pdf: async ({ request }) => {
		const formData = await request.formData();

		const reportTitle = formData.get('report_title')?.toString().trim() || 'Monthly Report';
		const dateStart = formData.get('date_range_start')?.toString() || '';
		const dateEnd = formData.get('date_range_end')?.toString() || '';
		const datasetsJson = formData.get('datasets')?.toString() || '[]';
		const chartsJson = formData.get('charts')?.toString() || '[]';
		const chartImagesJson = formData.get('chart_images')?.toString() || '{}';
		const _tableHtml = formData.get('table_html')?.toString() || '';
		const summaryStatsJson = formData.get('summary_stats')?.toString() || '{}';

		let datasets, charts, _chartImages, _summaryStats;
		try {
			datasets = JSON.parse(datasetsJson);
			charts = JSON.parse(chartsJson);
			_chartImages = JSON.parse(chartImagesJson);
			_summaryStats = JSON.parse(summaryStatsJson);
		} catch {
			return { success: false, error: 'Invalid form data.' };
		}

		if (!dateStart || !dateEnd) {
			return { success: false, error: 'Please select a date range.' };
		}

		// Format date range for display
		const startDate = new Date(dateStart + 'T12:00:00');
		const endDate = new Date(dateEnd + 'T12:00:00');
		const _dateRangeLabel = `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

		const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStart}_to_${dateEnd}.pdf`;

		try {
			// Build PDF as HTML and convert using a simple approach
			// We'll store the chart images and summary data as a structured PDF

			// For now, store the report metadata and chart images as a JSON blob
			// The actual PDF rendering happens client-side and is sent as base64
			const pdfBase64 = formData.get('pdf_base64')?.toString() || '';

			let pdfBuffer = null;
			let fileSize = 0;

			if (pdfBase64) {
				pdfBuffer = Buffer.from(pdfBase64, 'base64');
				fileSize = pdfBuffer.length;
			}

			// Save to database
			const [report] = await sql`
				INSERT INTO generated_reports (
					report_title,
					report_type,
					date_range_start,
					date_range_end,
					datasets,
					charts,
					pdf_data,
					pdf_filename,
					file_size_bytes,
					generated_by
				) VALUES (
					${reportTitle},
					'custom',
					${dateStart + '-01'},
					${dateEnd + '-01'},
					${JSON.stringify(datasets)},
					${JSON.stringify(charts)},
					${pdfBuffer},
					${filename},
					${fileSize},
					'admin'
				)
				RETURNING report_id, report_title, created_at
			`;

			console.log(`[monthly_reporting] Saved report ${report.report_id}: ${reportTitle} (${fileSize} bytes)`);

			return {
				success: true,
				action: 'generate_pdf',
				message: `Report "${reportTitle}" saved successfully.`,
				reportId: report.report_id
			};
		} catch (error) {
			console.error('Error saving report:', error);
			return { success: false, error: 'Failed to save report: ' + /** @type {Error} */ (error).message };
		}
	},

	download_report: async () => {
		// This action is handled by a separate endpoint
		return { success: false, error: 'Use the download endpoint instead.' };
	}
};