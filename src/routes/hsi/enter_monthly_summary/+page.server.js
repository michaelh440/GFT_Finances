// src/routes/hsi/enter_monthly_summary/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const classes = await sql`
      SELECT 
        class_code,
        class_name,
        track
      FROM classes
      WHERE is_active = true
      ORDER BY track ASC, class_name ASC
    `;

		return {
			classes
		};
	} catch (error) {
		console.error('Error loading classes:', error);
		return {
			classes: []
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
				const classCode = String(formData.get(`class_code_${i}`) || '');
				const month = String(formData.get(`month_${i}`) || '');
				const registrations = parseInt(String(formData.get(`registrations_${i}`))) || 0;
				const revenue = parseFloat(String(formData.get(`revenue_${i}`))) || 0;

				// Skip rows with no class or month selected
				if (!classCode || !month) {
					skipped++;
					continue;
				}

				// Skip rows where both values are 0
				if (registrations === 0 && revenue === 0) {
					skipped++;
					continue;
				}

				const summaryMonth = month + '-01';
				const summaryYear = parseInt(month.split('-')[0]);

				await sql`
          INSERT INTO monthly_class_summary (
            class_code,
            summary_month,
            summary_year,
            registrations,
            revenue,
            updated_at
          ) VALUES (
            ${classCode},
            ${summaryMonth},
            ${summaryYear},
            ${registrations},
            ${revenue},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (class_code, summary_month)
          DO UPDATE SET
            registrations = ${registrations},
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
			console.error('Error saving monthly summaries:', error);
			return {
				success: false,
				error: 'Failed to save summaries. Please try again.'
			};
		}
	}
};
