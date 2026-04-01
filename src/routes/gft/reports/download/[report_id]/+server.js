import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const GET = async ({ params, locals }) => {
	requirePermission(locals.user, 'gft', 'manager');
	const reportId = parseInt(params.report_id);

	if (isNaN(reportId)) {
		return new Response('Invalid report ID', { status: 400 });
	}

	try {
		const [report] = await sql`
			SELECT pdf_data, pdf_filename
			FROM generated_reports
			WHERE report_id = ${reportId}
		`;

		if (!report || !report.pdf_data) {
			return new Response('Report not found', { status: 404 });
		}

		return new Response(report.pdf_data, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${report.pdf_filename || 'report.pdf'}"`,
				'Content-Length': report.pdf_data.length.toString()
			}
		});
	} catch (error) {
		console.error('Error downloading report:', error);
		return new Response('Server error', { status: 500 });
	}
};
