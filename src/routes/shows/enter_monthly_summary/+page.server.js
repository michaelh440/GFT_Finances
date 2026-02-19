// src/routes/shows/enter_monthly_summary/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const shows = await sql`
      SELECT 
        show_code,
        show_name,
        format
      FROM shows
      WHERE is_active = true
      ORDER BY format ASC, show_name ASC
    `;

		return {
			shows
		};
	} catch (error) {
		console.error('Error loading shows:', error);
		return {
			shows: []
		};
	}
};

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const rowCount = parseInt(String(formData.get('row_count'))) || 0;

		if (rowCount === 0) {
			return { success: false, error: 'No data to save.' };
		}

		let saved = 0;
		let skipped = 0;

		try {
			for (let i = 0; i < rowCount; i++) {
				const showCode = String(formData.get(`show_code_${i}`) || '');
				const month = String(formData.get(`month_${i}`) || '');
				const ticketsSold = parseInt(String(formData.get(`tickets_sold_${i}`))) || 0;
				const revenue = parseFloat(String(formData.get(`revenue_${i}`))) || 0;

				if (!showCode || !month) {
					skipped++;
					continue;
				}

				if (ticketsSold === 0 && revenue === 0) {
					skipped++;
					continue;
				}

				const summaryMonth = month + '-01';
				const summaryYear = parseInt(month.split('-')[0]);

				await sql`
          INSERT INTO monthly_show_summary (
            show_code,
            summary_month,
            summary_year,
            tickets_sold,
            revenue,
            updated_at
          ) VALUES (
            ${showCode},
            ${summaryMonth},
            ${summaryYear},
            ${ticketsSold},
            ${revenue},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (show_code, summary_month)
          DO UPDATE SET
            tickets_sold = ${ticketsSold},
            revenue = ${revenue},
            summary_year = ${summaryYear},
            updated_at = CURRENT_TIMESTAMP
        `;
				saved++;
			}

			return {
				success: true,
				message: `Saved ${saved} ${saved === 1 ? 'entry' : 'entries'}${skipped > 0 ? `, skipped ${skipped} empty rows` : ''}.`
			};
		} catch (error) {
			console.error('Error saving show summaries:', error);
			return {
				success: false,
				error: 'Failed to save summaries. Please try again.'
			};
		}
	}
};
